import { NextResponse } from 'next/server';
import { VertexAI, Schema } from '@google-cloud/vertexai';
import { createSession } from '@/lib/firestore/stateEngine';
import { DeepResearchPlan } from '@/types';

// Initialize Vertex AI
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-hackathon-default',
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
1) openalex_search_authors(query, from_year?, to_year?, keywords?) -> returns candidate researchers with ids, works_count, cited_by_count, recent_works
2) openalex_get_author(author_id) -> returns author profile + affiliations + works timeline. NOTE: author_id must be a real OpenAlex ID (e.g. "https://openalex.org/A5091359268"). If you don't know the ID yet, set author_id to "CHAIN_FROM_PREVIOUS" and the executor will automatically use IDs from a prior openalex_search_authors step.
3) pubmed_search(query, from_year?, to_year?) -> returns PMIDs + metadata
4) pubmed_fetch(pmids) -> returns detailed records including authors, affiliations, corresponding author emails. NOTE: If pmids are not known yet, set pmids to "CHAIN_FROM_PREVIOUS" and the executor will chain from a prior pubmed_search step.
5) vertex_search_retrieve(query, filters?) -> returns passages with source ids/urls/snippets
6) firestore_get_session(session_id)
7) firestore_upsert_session(session_id, patch_object)
8) gcs_write(path, content_json_or_text) -> returns gs:// path
9) hitl_pause(session_id, question, options[]) -> marks session awaiting_confirmation and returns control to user
10) bigquery(disease_id) -> query hackathon BigQuery datasets for disease targets

=== CRITICAL: QUERY GENERATION RULES ===
You are the intelligence layer. The tools are dumb executors. YOU must generate proper, API-optimized queries.

For openalex_search_authors:
  - inputs.query MUST be a clean scientific/medical search term, NOT the user's raw natural language.
  - Example: User says "Find researchers who have published on idiopathic pulmonary fibrosis treatment in the last 3 years"
    -> inputs.query = "idiopathic pulmonary fibrosis treatment" (NOT the full sentence)
    -> inputs.keywords = ["IPF", "pulmonary fibrosis", "antifibrotic", "nintedanib", "pirfenidone"]
    -> inputs.from_year = 2023
    -> inputs.to_year = 2026
  - Always provide relevant medical keywords in the keywords array to improve search precision.
  - Always compute proper from_year/to_year integers based on the user request.

For pubmed_search:
  - inputs.query MUST be a proper PubMed search query using MeSH terms or medical keywords.
  - Example: User says "Find papers on CRISPR gene editing for sickle cell disease"
    -> inputs.query = "CRISPR sickle cell disease gene therapy"
    -> inputs.from_year = 2021
  - Do NOT pass natural language sentences. PubMed E-utilities needs keyword-based queries.

For openalex_get_author:
  - If the author ID is only available after a previous step runs, set inputs.author_id = "CHAIN_FROM_PREVIOUS"
  - The executor will automatically extract the top author IDs from the prior search step's results.

For pubmed_fetch:
  - If PMIDs are only available after a prior pubmed_search, set inputs.pmids = "CHAIN_FROM_PREVIOUS"
  - The executor will automatically chain the PMIDs from the prior step.

=== END QUERY RULES ===

Workflow requirements:
- Generate a plan with 2–6 steps (typically 3–5). Each step must be executable with the available tools.
- At minimum, support these intents when relevant: (a) disease grounding/synthesis, (b) researcher identification, (c) activity/recency verification, (d) contact discovery, (e) final report.
- Execute steps sequentially, updating Firestore after each step.
- Insert a HITL checkpoint after initial grounding/candidate identification OR before running expensive per-author verification.
- When awaiting confirmation, STOP and do not continue until the user responds.

HITL checkpoint requirements:
- Your execution pipeline is linear. Do NOT offer branching choices (A, B, C, D).
- The HITL checkpoint is meant to ensure human oversight before expensive operations or to allow the user to inject constraints.
- Pause and ask the user to review the current findings and confirm if they want to proceed with the next planned step.
- Example: "I found 10 candidate researchers based on your query. Please review their initial metrics above. Do you want me to proceed with extracting their detailed citations and contact info?"
- In the \`inputs.options\` array for the \`hitl_pause\` tool, provide linear progress options like: ["Approve & Proceed", "Cancel Execution"].

Plan DSL (ALWAYS output this exact valid JSON structure):
{
  "session_id": "WILL_BE_FILLED_BY_BACKEND",
  "user_request": "<original request>",
  "plan": [
    {
      "id": "S1",
      "name": "<step name>",
      "intent": "<retrieve|rank|verify|extract|synthesize|other>",
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
        const response = await generativeModel.generateContent(requestBody);

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

        // Log per-step breakdown with queries
        console.log(`🧠 [Plan] 📋 PLAN BREAKDOWN (${parsedPlan.plan.length} steps):`);
        for (const step of parsedPlan.plan) {
            console.log(`   ┌─ Step ${step.id}: ${step.name}`);
            console.log(`   │  Intent: ${step.intent}`);
            console.log(`   │  Tools: [${step.tools.join(', ')}]`);
            if (step.inputs.query) {
                console.log(`   │  🔍 Query: "${step.inputs.query}"`);
            }
            if (step.inputs.keywords && step.inputs.keywords.length > 0) {
                console.log(`   │  🏷️  Keywords: [${step.inputs.keywords.join(', ')}]`);
            }
            if (step.inputs.from_year || step.inputs.to_year) {
                console.log(`   │  📅 Year range: ${step.inputs.from_year || '?'} → ${step.inputs.to_year || '?'}`);
            }
            if (step.inputs.author_id) {
                console.log(`   │  👤 Author ID: ${step.inputs.author_id}`);
            }
            if (step.inputs.pmids) {
                console.log(`   │  📄 PMIDs: ${JSON.stringify(step.inputs.pmids)}`);
            }
            if (step.inputs.question) {
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
