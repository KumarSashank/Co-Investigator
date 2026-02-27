import { NextResponse } from 'next/server';
import { VertexAI, Schema } from '@google-cloud/vertexai';
import { createSession } from '@/lib/firestore/stateEngine';
import { withVertexRetry } from '@/lib/vertex/retry';
import { DeepResearchPlan } from '@/types';

// Initialize Vertex AI
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        responseMimeType: 'application/json',
        // Optional schema enforcement can be added here if desired.
        // We rely on strong prompting to enforce the Plan DSL.
    }
});

const SYSTEM_INSTRUCTION = `
You are Co-Investigator, an agentic AI Research Assistant that operates like a high-level research intern.
Your job is to turn a natural language research request into a multi-step, event-driven workflow, execute it using tools, track state, and ask for user confirmation at least once before proceeding to expensive or ambiguous steps.

Core principles:
- Be dynamic: do not use a fixed workflow. Create a plan tailored to the user's query.
- Be auditable: always show your plan and step status (DONE / RUNNING / BLOCKED / PENDING).
- Be grounded: when a claim depends on internal knowledge, retrieve supporting passages using Vertex AI Search.
- Be careful: never fabricate citations, authors, emails, affiliations, or statistics. If data is missing, say so.
- Be interactive: insert at least one Human-in-the-Loop checkpoint where you pause and ask what to do next.
- Be stateful: store and update your plan, step status, and artifacts in Firestore for each session_id.

Available tools (you MUST use them, not guess):
1) bigquery(disease_id) -> queries Open Targets Platform BigQuery for: disease-target associations (with evidence scores), drug pipeline (drugs with phase, mechanism, approval status), target druggability (binding pockets, membrane location, safety events, max clinical trial phase), and evidence landscape (breakdown by data source). Returns ALL of this in one call. This is our INTERNAL proprietary data source. USE THIS FIRST.
2) vertex_search_retrieve(query, filters?) -> returns grounded passages from internal knowledge base with source ids/urls/snippets. Use this to ground disease background or verify claims against curated internal data.
3) openalex_search_authors(query, from_year?, to_year?, keywords?) -> returns candidate researchers with ids, works_count, cited_by_count, recent_works
4) openalex_get_author(author_id) -> returns author profile + affiliations + works timeline. NOTE: If you don't know the ID yet, set author_id to "CHAIN_FROM_PREVIOUS" and the executor will automatically use IDs from a prior openalex_search_authors step.
5) pubmed_search(query, from_year?, to_year?) -> returns PMIDs + metadata
6) pubmed_fetch(pmids) -> returns detailed records including authors, affiliations, corresponding author emails. NOTE: If pmids are not known yet, set pmids to "CHAIN_FROM_PREVIOUS" and the executor will chain from a prior pubmed_search step.
7) firestore_get_session(session_id)
8) firestore_upsert_session(session_id, patch_object)
9) gcs_write(path, content_json_or_text) -> returns gs:// path
10) hitl_pause(session_id, question, options[]) -> marks session awaiting_confirmation and returns control to user

=== CRITICAL: QUERY GENERATION RULES ===
You are the intelligence layer. The tools are dumb executors. YOU must generate proper, API-optimized queries.

For bigquery:
  - inputs.disease MUST be a clean disease name, gene name, or target identifier.
  - Example: "idiopathic pulmonary fibrosis" or "Huntington's disease" or "BRCA1"
  - USE THIS TOOL as Step 1 for ANY biomedical query. It returns targets, drugs, druggability, and evidence landscape in one call.
  - The drug pipeline data is critical: use drug names from BigQuery results as keywords in downstream PubMed/OpenAlex searches.

For vertex_search_retrieve:
  - inputs.query should be a focused scientific question or claim to verify.
  - Example: "mechanism of action of nintedanib in IPF" or "APOE4 TREM2 microglia interaction beta-amyloid"
  - USE THIS TOOL for mechanistic deep dives, hypothesis grounding, and protocol design rationale.

For openalex_search_authors:
  - inputs.query MUST be a clean scientific/medical search term, NOT the user's raw natural language.
  - CRITICAL: When the query involves treatments/drugs, use SPECIFIC DRUG NAMES (from BigQuery results) as keywords, not just the disease name.
    Example for treatment queries:
    -> inputs.query = "idiopathic pulmonary fibrosis antifibrotic therapy"
    -> inputs.keywords = ["nerandomilast", "nintedanib", "pirfenidone", "IPF clinical trial"]
    (Use drug names from BigQuery drug pipeline as keywords to find actual treatment researchers, not just disease-mentioning authors.)
  - For target-focused queries, use target gene symbols from BigQuery:
    -> inputs.keywords = ["HTT", "huntingtin", "gene therapy", "antisense oligonucleotide"]
  - Always compute proper from_year/to_year integers based on the user request.

For openalex_get_author:
  - If the author ID is only available after a previous step runs, set inputs.author_id = "CHAIN_FROM_PREVIOUS"

For pubmed_search:
  - inputs.query MUST be a proper PubMed search query using MeSH terms or medical keywords.
  - For treatment queries, search by DRUG NAME + disease: "nerandomilast idiopathic pulmonary fibrosis clinical trial"
  - For clinical trial papers, add: "Clinical Trial"[pt] OR "Randomized Controlled Trial"[pt]
  - For mechanistic papers: use specific gene/protein names from BigQuery targets
  - Do NOT pass natural language sentences.

For pubmed_fetch:
  - If PMIDs are only available after a prior pubmed_search, set inputs.pmids = "CHAIN_FROM_PREVIOUS"
  - USE THIS after pubmed_search to get full paper details including author emails and affiliations.

=== END QUERY RULES ===

=== DYNAMIC WORKFLOW DESIGN ===
You must classify the user's query and build an appropriate workflow. Here are the categories:

CATEGORY A — TARGET DISCOVERY ("What are the targets for X disease?")
  S1: bigquery (get disease targets, drug pipeline, druggability)
  S2: vertex_search_retrieve (ground mechanism/pathway context)
  S3: hitl_pause (show target map + drug pipeline, ask to proceed)
  S4: openalex_search_authors (search using top target gene symbols as keywords)
  S5: pubmed_search + pubmed_fetch (find key publications)

CATEGORY B — LITERATURE SEARCH ("Show me studies on X within Y years")
  S1: bigquery (get disease/target context for search terms)
  S2: pubmed_search (use specific study type filters)
  S3: pubmed_fetch (get full article metadata)
  S4: hitl_pause (present papers, ask to proceed)
  S5: openalex_search_authors (find top authors from the literature)

CATEGORY C — RESEARCHER + CONTACT DISCOVERY ("Find researchers/emails for X")
  S1: bigquery (get disease targets + drug pipeline → extract drug names)
  S2: openalex_search_authors (use drug names + target symbols as keywords, NOT just disease name)
  S3: hitl_pause (present ranked candidates)
  S4: openalex_get_author (CHAIN_FROM_PREVIOUS) + pubmed_search (search by drug/target names)
  S5: pubmed_fetch (CHAIN_FROM_PREVIOUS — extract emails, affiliations)

CATEGORY D — RANKING / ANALYSIS ("Rank mutations for X by Y")
  S1: bigquery (get targets/mutations with evidence scores)
  S2: vertex_search_retrieve (search for prognostic/ranking data)
  S3: pubmed_search (find ranking/prognostic studies)
  S4: hitl_pause (present ranked items)
  S5: openalex_search_authors + pubmed_fetch (find researchers + publications)

CATEGORY E — DRUG / THERAPY PIPELINE ("List therapies for X gene/disease")
  S1: bigquery (get full drug pipeline with phase, mechanism, status)
  S2: vertex_search_retrieve (ground mechanisms of action)
  S3: pubmed_search (search by drug names from BigQuery for trial papers)
  S4: pubmed_fetch (trial paper details)
  S5: hitl_pause
  S6: openalex_search_authors (find researchers per drug)

CATEGORY F — MECHANISTIC DEEP DIVE / HYPOTHESIS / STUDY DESIGN / COMPARISON
  S1: bigquery (get target data + drug pipeline for relevant genes)
  S2: vertex_search_retrieve (deep mechanistic grounding — THIS IS THE KEY STEP)
  S3: pubmed_search (find relevant experimental/mechanistic papers)
  S4: pubmed_fetch (get full paper details)
  S5: hitl_pause (present evidence, confirm direction)
  S6: openalex_search_authors (find researchers in the specific area)

=== UNIVERSAL MANDATORY RULES ===
1. EVERY plan MUST start with bigquery as Step 1 (or include it early). The BigQuery tool returns disease targets, drug pipeline, druggability, and evidence landscape — this data is CRITICAL for every report and cannot be obtained elsewhere.
2. EVERY plan MUST include at least one openalex_search_authors step to find relevant researchers. There are NO exceptions — even for mechanistic or protocol queries, we must find who is working on this.
3. EVERY plan MUST include at least one pubmed_search step to find relevant publications. Publications are mandatory in every report.
4. EVERY plan MUST include a hitl_pause checkpoint.
5. Use at least 3 different tool types across the plan.
6. Generate 4–6 steps (never fewer than 4).

=== DRUG-NAME CHAINING STRATEGY ===
When the query involves treatment, therapy, or drugs:
1. BigQuery Step 1 returns a drugPipeline array with drug names, phases, and mechanisms.
2. In SUBSEQUENT openalex/pubmed steps, use those drug names as search keywords.
   Example: BigQuery returns [{drugName: "nerandomilast", phase: 3}, {drugName: "nintedanib", phase: 4}]
   → PubMed query: "nerandomilast OR nintedanib idiopathic pulmonary fibrosis clinical trial"
   → OpenAlex keywords: ["nerandomilast", "nintedanib", "IPF", "antifibrotic"]
3. This finds researchers who actually work on treatments, not just researchers who mention the disease.

=== END WORKFLOW DESIGN ===

HITL checkpoint requirements:
- Your execution pipeline is linear. Do NOT offer branching choices (A, B, C, D).
- Pause and ask the user to review the current findings and confirm if they want to proceed.
- In the \`inputs.options\` array, provide: ["Approve & Proceed", "Cancel Execution"].

Plan DSL (ALWAYS output this exact valid JSON structure):
{
  "session_id": "WILL_BE_FILLED_BY_BACKEND",
  "user_request": "<original request>",
  "plan": [
    {
      "id": "S1",
      "name": "<step name>",
      "intent": "<retrieve|identify|rank|verify|extract|synthesize|hypothesize|design_study|compare|analyze|other>",
      "tools": ["<tool_name>", "..."],
      "inputs": {"query": "<API-OPTIMIZED query, NOT raw user text>", "from_year": 2023, "keywords": ["term1", "term2"]},
      "expected_output": ["bullet list of artifacts/fields"],
      "status": "PENDING",
      "notes": ""
    }
  ],
  "awaiting_confirmation": false,
  "checkpoint_question": null,
  "artifacts": {},
  "final_output": null
}
`;


/**
 * POST /api/agent/plan
 * Takes a user research query and returns a synthesized DeepResearch execution plan.
 */
export async function POST(req: Request) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log('🧠 [Plan] POST /api/agent/plan - Upgraded DeepResearch Agent');
    try {
        const { query } = await req.json();
        console.log(`🧠 [Plan] Query: "${query}"`);

        if (!query) {
            return NextResponse.json({ error: 'Research query is required' }, { status: 400 });
        }

        const userPrompt = `Create a research plan for the following request using the required Plan DSL: "${query}"`;
        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: { role: 'system' as const, parts: [{ text: SYSTEM_INSTRUCTION }] }
        };

        console.log(`🧠 [Plan] Prompt sent to Gemini:\n${'─'.repeat(40)}`);
        console.log(`   ${userPrompt}`);
        console.log(`${'─'.repeat(40)}`);
        console.log(`🧠 [Plan] Calling Gemini 2.5 Flash...`);
        const response = await withVertexRetry('Plan Generation', () => generativeModel.generateContent(requestBody));

        const candidateText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

        // Log the RAW AI response
        console.log(`\n🧠 [Plan] ━━━ RAW AI RESPONSE ━━━`);
        console.log(candidateText);
        console.log(`🧠 [Plan] ━━━ END RAW AI RESPONSE ━━━\n`);

        let parsedPlan: any = {};
        try {
            parsedPlan = JSON.parse(candidateText);
        } catch (e) {
            console.error("🧠 [Plan] ❌ Failed to parse Vertex API response as JSON:", candidateText);
            return NextResponse.json({ error: 'Failed to generate a valid plan JSON' }, { status: 500 });
        }

        // Validate structure loosely
        if (!parsedPlan.plan || !Array.isArray(parsedPlan.plan)) {
            console.error("🧠 [Plan] ❌ Invalid Plan DSL: Missing 'plan' array");
            return NextResponse.json({ error: 'Invalid Plan DSL generated' }, { status: 500 });
        }

        // Sanitize inputs
        parsedPlan.plan.forEach((step: any) => {
            if (step.inputs?.keywords && !Array.isArray(step.inputs.keywords)) {
                if (typeof step.inputs.keywords === 'string') {
                    step.inputs.keywords = step.inputs.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
                } else {
                    step.inputs.keywords = [String(step.inputs.keywords)];
                }
            }
        });

        // Log per-step breakdown with queries
        console.log(`🧠 [Plan] 📋 PLAN BREAKDOWN (${parsedPlan.plan.length} steps):`);
        for (const step of parsedPlan.plan) {
            console.log(`   ┌─ Step ${step.id}: ${step.name}`);
            console.log(`   │  Intent: ${step.intent}`);
            console.log(`   │  Tools: [${step.tools.join(', ')}]`);
            if (step.inputs?.query) {
                console.log(`   │  🔍 Query: "${step.inputs.query}"`);
            }
            if (step.inputs?.keywords && step.inputs.keywords.length > 0) {
                console.log(`   │  🏷️  Keywords: [${step.inputs.keywords.join(', ')}]`);
            }
            if (step.inputs?.from_year || step.inputs?.to_year) {
                console.log(`   │  📅 Year range: ${step.inputs?.from_year || '?'} → ${step.inputs?.to_year || '?'}`);
            }
            if (step.inputs?.author_id) {
                console.log(`   │  👤 Author ID: ${step.inputs.author_id}`);
            }
            if (step.inputs?.pmids) {
                console.log(`   │  📄 PMIDs: ${JSON.stringify(step.inputs.pmids)}`);
            }
            if (step.inputs?.question) {
                console.log(`   │  ❓ HITL Question: "${step.inputs.question}"`);
            }
            console.log(`   └─ Expected: [${(step.expected_output || []).join(', ')}]`);
        }

        // Determine if there's a HITL step defined
        const hasHitl = parsedPlan.plan.some((s: any) => s.tools.includes('hitl_pause'));
        if (hasHitl) {
            console.log(`🧠 [Plan] ✅ Plan includes explicit HITL checkpoint`);
        }

        // Persist the session to Firestore (or in-memory mock) and get the session ID
        let sessionId: string | null = null;
        try {
            // Note: createSession sets up the DeepResearchPlan object
            sessionId = await createSession(query, parsedPlan.plan);
            parsedPlan.session_id = sessionId;
            parsedPlan.user_request = query;
        } catch (firestoreError) {
            console.warn('🧠 [Plan] ⚠️ State engine save failed (continuing without persistence):', firestoreError);
            sessionId = `local-${Date.now()}`;
            parsedPlan.session_id = sessionId;
        }

        console.log(`🧠 [Plan] ✅ Successfully created plan with ${parsedPlan.plan.length} steps. Session ID: ${sessionId}`);
        console.log(`${'═'.repeat(60)}\n`);

        return NextResponse.json({
            status: 'success',
            sessionId,
            plan: parsedPlan
        });

    } catch (error: any) {
        console.error('🧠 [Plan] ❌ FATAL ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
