import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { createSession } from '@/lib/firestore/stateEngine';
import { DeepResearchPlan } from '@/types';

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
  location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
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
1) bigquery(disease_id) -> query hackathon BigQuery datasets for disease targets, pathways, and gene associations.
2) vertex_search_retrieve(query, filters?) -> returns grounded passages from internal knowledge base.
3) openalex_search_authors(query, from_year?, to_year?, keywords?) -> returns candidate researchers.
4) openalex_get_author(author_id) -> returns author profile + affiliations + works timeline. Set author_id to "CHAIN_FROM_PREVIOUS" if not known yet.
5) pubmed_search(query, from_year?, to_year?) -> returns PMIDs + metadata
6) pubmed_fetch(pmids) -> returns detailed records. Set pmids to "CHAIN_FROM_PREVIOUS" if not known yet.
7) hitl_pause(session_id, question, options[]) -> marks session awaiting_confirmation.
8) firestore_get_session(session_id)
9) firestore_upsert_session(session_id, patch_object)
10) gcs_write(path, content_json_or_text) -> returns gs:// path

=== CRITICAL: QUERY GENERATION RULES ===
For bigquery: inputs.disease MUST be a clean disease name or target identifier.
For openalex_search_authors: inputs.query MUST be clean scientific terms, NOT natural language sentences. Always provide keywords array.
For pubmed_search: inputs.query MUST be proper PubMed search terms using medical keywords, NOT natural language.
For pubmed_fetch: Set inputs.pmids = "CHAIN_FROM_PREVIOUS" to chain from prior pubmed_search.
For openalex_get_author: Set inputs.author_id = "CHAIN_FROM_PREVIOUS" to chain from prior search.

=== MANDATORY WORKFLOW TEMPLATE ===
Step 1 (Disease Grounding): Use bigquery to gather disease/target background data.
Step 2 (Researcher Discovery): Use openalex_search_authors to find candidate researchers.
Step 3 (HITL Checkpoint): Use hitl_pause to present initial findings and ask user to confirm.
Step 4 (Deep Verification): Use openalex_get_author (CHAIN_FROM_PREVIOUS) AND pubmed_search to cross-reference.
Step 5 (Contact Extraction): Use pubmed_fetch (CHAIN_FROM_PREVIOUS) to extract emails and affiliations.

Plan DSL (ALWAYS output this exact valid JSON structure):
{
  "session_id": "WILL_BE_FILLED_BY_BACKEND",
  "user_request": "<original request>",
  "plan": [
    {
      "id": "S1",
      "name": "<step name>",
      "intent": "<retrieve|rank|verify|extract|synthesize|other>",
      "tools": ["<tool_name>"],
      "inputs": {"query": "<API-OPTIMIZED query>", "from_year": 2023, "keywords": ["term1"]},
      "expected_output": ["bullet list of artifacts"],
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

// ============================================================
// SMART REGEX FALLBACK — generates a proper 5-step plan when Gemini is unavailable
// ============================================================
function extractQueryTerms(query: string): { disease: string; gene: string; topic: string; pubmedQuery: string; keywords: string[] } {
  const q = query.toLowerCase();

  // Common disease patterns
  const diseases: Record<string, string> = {
    'ipf': 'idiopathic pulmonary fibrosis', 'pulmonary fibrosis': 'idiopathic pulmonary fibrosis',
    'alzheimer': "Alzheimer's disease", 'als': 'amyotrophic lateral sclerosis',
    'parkinson': "Parkinson's disease", 'breast cancer': 'breast cancer',
    'lung cancer': 'lung cancer', 'nsclc': 'non-small cell lung cancer',
    'pancreatic': 'pancreatic cancer', 'diabetes': 'type 2 diabetes',
    'leukemia': 'leukemia', 'melanoma': 'melanoma',
    'glioblastoma': 'glioblastoma', 'lymphoma': 'lymphoma',
    'colorectal': 'colorectal cancer', 'prostate cancer': 'prostate cancer',
    'ovarian': 'ovarian cancer', 'hepatitis': 'hepatitis',
    'covid': 'COVID-19', 'sars': 'SARS-CoV-2',
    'fibrosis': 'fibrosis', 'carcinoma': 'carcinoma',
  };

  // Gene patterns
  const geneRegex = /\b([A-Z][A-Z0-9]{1,10}(?:L\d)?)\b/g;
  const geneMatches = query.match(geneRegex) || [];
  const commonWords = new Set(['THE', 'AND', 'FOR', 'WITH', 'FROM', 'THAT', 'THIS', 'WHAT', 'FIND', 'HOW', 'ARE', 'CAN', 'WHO', 'NOT', 'ALL', 'HAS', 'ITS', 'MAY']);
  const genes = geneMatches.filter(g => !commonWords.has(g) && g.length >= 2);

  let disease = '';
  for (const [key, value] of Object.entries(diseases)) {
    if (q.includes(key)) { disease = value; break; }
  }
  if (!disease) {
    // Try to extract disease from context
    const diseaseMatch = q.match(/(?:for|of|in|on|about|treating|treatment)\s+([a-z\s-]+?)(?:\s+(?:gene|target|treatment|therapy|research|disease)|$)/i);
    if (diseaseMatch) disease = diseaseMatch[1].trim();
  }

  const gene = genes[0] || '';
  const topic = disease || gene || query.slice(0, 60);
  const keywords = [disease, gene, ...genes.slice(1)].filter(Boolean);
  const pubmedQuery = [disease, gene, 'treatment research'].filter(Boolean).join(' ');

  return { disease: disease || topic, gene, topic, pubmedQuery, keywords };
}

function generateFallbackPlan(query: string): any {
  const { disease, gene, topic, pubmedQuery, keywords } = extractQueryTerms(query);
  const currentYear = new Date().getFullYear();

  return {
    session_id: 'WILL_BE_FILLED_BY_BACKEND',
    user_request: query,
    plan: [
      {
        id: 'S1', name: `Query disease-target associations and clinical evidence for ${topic}`,
        intent: 'retrieve', tools: ['bigquery'],
        inputs: { disease: disease || topic },
        expected_output: ['disease-target associations', 'evidence scores', 'pathways'],
        status: 'PENDING', notes: 'BigQuery CIViC/PrimeKG datasets'
      },
      {
        id: 'S2', name: `Search PubMed for recent publications on ${topic}`,
        intent: 'retrieve', tools: ['pubmed_search'],
        inputs: { query: pubmedQuery, from_year: currentYear - 3, to_year: currentYear },
        expected_output: ['PMIDs', 'publication metadata'],
        status: 'PENDING', notes: 'PubMed E-utilities search'
      },
      {
        id: 'S3', name: 'Review initial findings before deep analysis',
        intent: 'other', tools: ['hitl_pause'],
        inputs: {
          question: `I've gathered disease-target data and identified recent publications for "${topic}". Should I proceed to identify key researchers and extract detailed publication data?`,
          options: ['Approve & Proceed', 'Cancel Execution']
        },
        expected_output: ['user_approval'],
        status: 'PENDING', notes: 'HITL checkpoint'
      },
      {
        id: 'S4', name: `Identify key researchers and citation metrics for ${topic}`,
        intent: 'rank', tools: ['openalex_search_authors'],
        inputs: { query: disease || topic, from_year: currentYear - 3, to_year: currentYear, keywords },
        expected_output: ['ranked researchers', 'citation metrics', 'institutions'],
        status: 'PENDING', notes: 'OpenAlex works + author aggregation'
      },
      {
        id: 'S5', name: `Extract detailed publication data and contact information`,
        intent: 'extract', tools: ['pubmed_fetch'],
        inputs: { pmids: 'CHAIN_FROM_PREVIOUS' },
        expected_output: ['full articles', 'author affiliations', 'corresponding emails'],
        status: 'PENDING', notes: 'PubMed efetch for detailed metadata'
      },
    ],
    awaiting_confirmation: false,
    checkpoint_question: null,
    artifacts: {},
    final_output: null
  };
}


/**
 * POST /api/agent/plan
 * Takes a user research query and returns a synthesized DeepResearch execution plan.
 */
export async function POST(req: Request) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('🧠 [Plan] POST /api/agent/plan - DeepResearch Agent');
  try {
    const { query } = await req.json();
    console.log(`🧠 [Plan] Query: "${query}"`);

    if (!query) {
      return NextResponse.json({ error: 'Research query is required' }, { status: 400 });
    }

    let parsedPlan: any;
    let usedFallback = false;

    // Try Gemini first, fall back to smart regex planner
    try {
      const userPrompt = `Create a research plan for the following request using the required Plan DSL: "${query}"`;
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system' as const, parts: [{ text: SYSTEM_INSTRUCTION }] }
      };

      console.log(`🧠 [Plan] Calling Gemini 2.5 Flash...`);
      const response = await generativeModel.generateContent(requestBody);
      const candidateText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

      console.log(`\n🧠 [Plan] ━━━ RAW AI RESPONSE ━━━`);
      console.log(candidateText);
      console.log(`🧠 [Plan] ━━━ END RAW AI RESPONSE ━━━\n`);

      parsedPlan = JSON.parse(candidateText);

      if (!parsedPlan.plan || !Array.isArray(parsedPlan.plan)) {
        throw new Error('Invalid Plan DSL: Missing plan array');
      }
      console.log(`🧠 [Plan] ✅ Gemini generated ${parsedPlan.plan.length} steps`);

    } catch (geminiError: any) {
      console.warn(`🧠 [Plan] ⚠️ Gemini unavailable: ${geminiError.message}. Using smart fallback planner.`);
      parsedPlan = generateFallbackPlan(query);
      usedFallback = true;
      console.log(`🧠 [Plan] ✅ Fallback generated ${parsedPlan.plan.length} steps`);
    }

    // Log per-step breakdown
    console.log(`🧠 [Plan] 📋 PLAN BREAKDOWN (${parsedPlan.plan.length} steps):`);
    for (const step of parsedPlan.plan) {
      console.log(`   ┌─ Step ${step.id}: ${step.name}`);
      console.log(`   │  Intent: ${step.intent} | Tools: [${step.tools.join(', ')}]`);
      if (step.inputs.query) console.log(`   │  🔍 Query: "${step.inputs.query}"`);
      if (step.inputs.disease) console.log(`   │  🏥 Disease: "${step.inputs.disease}"`);
      if (step.inputs.keywords?.length) console.log(`   │  🏷️  Keywords: [${step.inputs.keywords.join(', ')}]`);
      console.log(`   └─ Expected: [${(step.expected_output || []).join(', ')}]`);
    }

    // Persist the session
    let sessionId: string | null = null;
    try {
      sessionId = await createSession(query, parsedPlan.plan);
      parsedPlan.session_id = sessionId;
      parsedPlan.user_request = query;
    } catch (firestoreError) {
      console.warn('🧠 [Plan] ⚠️ State engine save failed (continuing without persistence):', firestoreError);
      sessionId = `local-${Date.now()}`;
      parsedPlan.session_id = sessionId;
    }

    console.log(`🧠 [Plan] ✅ Plan created. Session: ${sessionId} | Fallback: ${usedFallback}`);
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
