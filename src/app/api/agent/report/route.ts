import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { firestore_get_session, firestore_upsert_session } from '@/lib/firestore/stateEngine';
import { withVertexRetry } from '@/lib/vertex/retry';
import { logger } from '@/lib/logger';

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // Using Google Search Grounding to verify external facts
    // Note: Gemini 2.5 Flash requires "googleSearch", not "googleSearchRetrieval"
    // The SDK types are outdated, so we cast to any
    tools: [{ googleSearch: {} } as any]
});

const LOG = '🧠 [Report]';

const REPORT_SYSTEM_INSTRUCTION = `
You are Co-Investigator, a high-level research intern.
Your task is to synthesize the raw data collected during the research session into a final markdown report.

CRITICAL: You MUST output a structured Markdown report with ALL of these MANDATORY sections.
Use the actual data from the artifacts — never fabricate data. If data is missing, say so explicitly.

## 1. Executive Summary
A 3-5 sentence overview of the research question, what was found, and the key takeaway.
Every factual claim MUST include an inline citation like [Source: PubMed PMID:12345678] or [Source: OpenAlex] or [Source: BigQuery Open Targets] or [Source: Google Search Grounding].

## 2. Plan & Steps Taken
List the execution plan and the final status of each step as a table.

## 3. Disease / Topic Synthesis
Grounded summary of what was found about the disease/topic.
- Every statement of fact MUST be followed by an inline source citation.
- If a claim cannot be cited, explicitly write "[No citation available]"

## 4. Molecular Target Map
Present the TOP targets from BigQuery data as a TABLE with these columns:
| Rank | Target Gene | Target Name | Evidence Score | Clinical Relevance |
For each target, explain in 1 sentence why it matters for the disease/query.
This section uses data from the "associatedTargets" field in the BigQuery artifact.
If no BigQuery target data is available, state "No target data available from BigQuery."

## 5. Drug & Therapy Landscape
Present the drug pipeline from BigQuery data as a TABLE:
| Drug Name | Target | Mechanism of Action | Phase | Status |
Group by clinical phase (Phase 4/Approved first, then Phase 3, 2, 1).
This section uses data from the "drugPipeline" field in the BigQuery artifact.
If no drug pipeline data is available, state "No drug pipeline data available from BigQuery."

## 6. Target Druggability Assessment
IF druggability data is available from BigQuery, present a TABLE:
| Target | Membrane Protein | Has Binding Pocket | Small Molecule Binder | Safety Events | Max Clinical Phase |
This section uses data from the "targetDruggability" field in the BigQuery artifact.
If no druggability data is available, state "Druggability assessment not available for these targets."

## 7. Key Researchers
For EACH researcher identified, provide:

### Researcher Name — Institution
- **OpenAlex Profile**: Link to their OpenAlex profile using the "profileUrl" field
- **Why they are relevant**: 2-3 sentences connecting their work to the search topic.
- **Key relevant publications**: List 2-5 papers with Title, Year, DOI, Citation count
- **Metrics**: h-index, total citations, works count (exact numbers from artifact data)
- **Activity level**: ACTIVE/MODERATE/LOW
- **Contact**: Email if found, otherwise "Email not found — affiliated with [Institution Name]"

CRITICAL: Use the "currentInstitution" field from the researcher data for institution names. NEVER display "Unknown" if the data has an actual institution name. If the institution is truly unknown, try to extract it from PubMed affiliation data.

Present a summary table at the top:
| Rank | Name | Institution | Profile | h-index | Citations | Works | Activity | Score |

## 8. Key Publications
List the TOP 10 most relevant publications found across all steps:
| # | Title | Authors | Year | Journal | Citations | DOI |
Include publications from BOTH OpenAlex researcher data AND PubMed search results.

## 9. Data Quality & Provenance
Report the data sources used and their quality:
- BigQuery: What was queried, when (timestamp), how many targets/drugs/evidence sources found
- OpenAlex: How many authors searched, how many returned
- PubMed: How many articles searched, how many fetched
- Vertex AI Search: What queries were grounded
This demonstrates the system's real-time database access — something no other tool can provide.

## 10. Next-Step Suggestions
3-5 logical next steps, each with a brief justification grounded in the gaps found.

=== QUERY-SPECIFIC BONUS SECTIONS ===
Based on the original query type, ADD one or more of these bonus sections BETWEEN sections 3 and 4:

- For MECHANISTIC queries (gene interactions, pathways): Add "## Hypothesis & Mechanism Analysis" with testable hypotheses
- For STUDY DESIGN queries (mouse models, protocols): Add "## Proposed Protocol" with study design details
- For COMPARISON queries (drug A vs drug B): Add "## Comparison Matrix" with side-by-side analysis
- For RANKING queries (mutations, targets by criteria): Add "## Ranked Analysis" with evidence-backed ranking table
- For PROTOCOL queries (CRISPR, experimental methods): Add "## Protocol Steps" with step-by-step methods

=== STRICT CITATION RULES ===
- NEVER invent a DOI, PMID, author name, email, affiliation, or journal name.
- Use publication titles verbatim from artifact data.
- When Google Search Grounding provides a fact, cite it as "[Source: Google Search Grounding]"
- For BigQuery data, cite as "[Source: BigQuery Open Targets]"
`;


export async function POST(req: Request) {
    logger.info(`\n${'═'.repeat(60)}`);
    logger.info(`${LOG} POST /api/agent/report - DeepResearch Synthesis`);
    try {
        const { sessionId } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const session = await firestore_get_session(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        logger.info(`${LOG} Synthesizing report for query: "${session.user_request}"`);

        // Build context from AI agent summaries AND chainable raw data (researcher profiles, etc.)
        // The AI analyses provide reasoning, and chainable_data provides the hard facts
        // (names, scores, h-indices, profile URLs, DOIs) for the report table.
        const agentContext = session.plan.map((step: any) => ({
            stepId: step.id,
            name: step.name,
            intent: step.intent,
            tools: step.tools,
            status: step.status,
            ai_analysis: step.result_data?.ai_analysis || null,
            researcher_data: step.result_data?.chainable_data?.openalex_search_authors
                || step.result_data?.chainable_data?.openalex_get_author
                || null,
            pubmed_data: step.result_data?.chainable_data?.pubmed_fetch || null,
            bigquery_data: step.result_data?.chainable_data?.bigquery || null,
            vertex_search_data: step.result_data?.chainable_data?.vertex_search_retrieve || null,
            data_counts: step.result_data?.data_counts || null,
        }));

        const contextData = JSON.stringify({
            originalQuery: session.user_request,
            agentAnalyses: agentContext,
            gcsArtifacts: session.artifacts || {}
        }, null, 2);

        logger.info(`${LOG} Context size: ${contextData.length} characters (clean, no raw data)`);

        const requestBody = {
            contents: [{
                role: 'user',
                parts: [
                    { text: `Generate the final research report based on this execution data:\n\n${contextData}` }
                ]
            }],
            systemInstruction: { role: 'system' as const, parts: [{ text: REPORT_SYSTEM_INSTRUCTION }] }
        };

        logger.info(`${LOG} Calling Gemini 2.5 Flash for grounded synthesis...`);

        let reportMarkdown: string;
        try {
            const response = await withVertexRetry('Report Generation (Primary)', () => generativeModel.generateContent(requestBody));
            reportMarkdown = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate report text.";
        } catch (primaryError: any) {
            // If the googleSearch grounding tool fails, retry WITHOUT it
            logger.warn(`${LOG} ⚠️ Primary model (with Google Search) failed: ${primaryError.message}. Retrying without grounding...`);

            const fallbackModel = vertexAI.getGenerativeModel({
                model: 'gemini-2.0-flash', // Faster, no grounding tool
            });
            const fallbackResponse = await withVertexRetry('Report Generation (Fallback)', () => fallbackModel.generateContent(requestBody));
            reportMarkdown = fallbackResponse.response.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate report text.";
            reportMarkdown += "\n\n> ⚠️ *Note: This report was generated without Google Search Grounding due to a temporary service issue.*";
        }

        logger.info(`${LOG} ✅ Report generated (${reportMarkdown.length} characters)`);

        // Update session
        await firestore_upsert_session(sessionId, { final_output: reportMarkdown });

        logger.info(`${'═'.repeat(60)}\n`);

        return NextResponse.json({
            status: 'success',
            report: reportMarkdown
        });

    } catch (error: any) {
        logger.error({ err: error.message, stack: error.stack }, `${LOG} ❌ FATAL REPORT ERROR`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
