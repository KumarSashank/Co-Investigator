import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { firestore_get_session, firestore_upsert_session } from '@/lib/firestore/stateEngine';
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

CRITICAL REQUIREMENTS:
You MUST output a structured Markdown report with EXACTLY these sections:

## 1. Executive Summary
A 3-5 sentence overview of the research question, what was found, and the key takeaway.
Every factual claim MUST include an inline citation like [Source: PubMed PMID:12345678] or [Source: OpenAlex] or [Source: Google Search Grounding].

## 2. Plan & Steps Taken
List the execution plan and the final status of each step as a table.

## 3. Disease / Topic Synthesis
Grounded summary of what was found about the disease/topic. 
- Every statement of fact MUST be followed by an inline source citation.
- Format: "Statement text [Source: database_name, identifier]"
- Example: "IPF affects approximately 3 million people worldwide [Source: Google Search Grounding]"
- If a claim cannot be cited from the retrieved data or Google Search, explicitly write "[No citation available]"

## 4. Top Researchers
For EACH researcher identified, provide:

### Researcher Name — Institution
- **OpenAlex Profile**: Link to their OpenAlex profile using the "profileUrl" field from the artifact data (e.g., https://openalex.org/A5073917506)
- **Why they are relevant**: 2-3 sentences explaining specifically why this researcher is relevant to the user's query. Connect their work to the search topic.
- **Key relevant publications**: List 2-5 of their most relevant papers. For each publication, include:
  - Title (verbatim from the data)
  - Year
  - DOI link if available (from the "doi" field, e.g., https://doi.org/10.xxxx)
  - OpenAlex work URL if no DOI (from the "url" field)
  - Citation count
- **Metrics**: h-index, total citations, works count (use the exact numbers from the "metrics" object in the artifact data)
- **Activity level**: From the "activityLevel" field (ACTIVE/MODERATE/LOW)
- **Contact**: Email if found in PubMed metadata, otherwise state "Email not found — affiliated with [Institution Name]"

Present a summary table at the top:
| Rank | Name | Institution | Profile | h-index | Citations | Works | Activity | Score |
|------|------|-------------|---------|---------|-----------|-------|----------|-------|

In the Profile column, make the OpenAlex URL a clickable link.
Then provide the detailed profiles below the table.

## 5. Sources & References
Compile ALL sources used in the report as a numbered reference list:
- [1] Author et al., "Title", Journal, Year. PMID: XXXXX
- [2] OpenAlex Author Profile: [URL]
- Include any Google Search Grounding sources used

## 6. Raw Artifacts
List the gs:// paths or local paths where the raw JSON data is stored.

## 7. Next-Step Suggestions
2-3 logical next steps for the researcher, each with a brief justification.

STRICT CITATION RULES:
- NEVER invent a DOI, PMID, author name, email, affiliation, or journal name.
- If the artifact data contains publication titles, use them verbatim.
- If you cannot cite a claim using the provided artifact data or Google Search Grounding, say "[No citation available from retrieved sources]"
- For researcher profiles, rely purely on the OpenAlex/PubMed metadata provided in the artifacts.
- When Google Search Grounding provides a fact, cite it as "[Source: Google Search Grounding]"
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

        // Stringify the plan and all collected result data to give Gemini full context.
        // In a true massive-data system, we would stream the GCS artifacts directly, 
        // but passing the aggregated JSON is sufficient and highly reliably for gemini-2.5-flash context windows.
        const contextData = JSON.stringify({
            originalQuery: session.user_request,
            planSteps: session.plan,
            gcsArtifacts: session.artifacts || {}
        }, null, 2);

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
        const response = await generativeModel.generateContent(requestBody);

        let reportMarkdown = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate report text.";

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
