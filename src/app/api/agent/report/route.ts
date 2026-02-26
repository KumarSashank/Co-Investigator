import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { firestore_get_session, firestore_upsert_session } from '@/lib/firestore/stateEngine';
import { logger } from '@/lib/logger';

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-hackathon-default',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // Using Google Search Grounding to verify external facts
    tools: [{ googleSearch: {} }]
});

const LOG = '🧠 [Report]';

const REPORT_SYSTEM_INSTRUCTION = `
You are Co-Investigator, a high-level research intern.
Your task is to synthesize the raw data collected during the research session into a final markdown report.

CRITICAL REQUIREMENTS:
You MUST output a structured Markdown report with EXACTLY these 6 sections:
1) **Plan & Steps Taken**: List the execution plan and the final status of each step.
2) **Disease Synthesis**: Grounded summary and synthesis of the disease/target findings. Cite your sources using the provided tool artifacts.
3) **Top Researchers**: A detailed markdown table requiring: [Name, Institution, Score, Activity Level, Last Relevant Pub Date, Evidence Links].
4) **Contact Leads**: Extracted emails if found, otherwise explicitly state "Email not found in PubMed metadata" and list affiliation + source.
5) **Raw Artifacts**: List the gs:// paths where the raw JSON data is stored.
6) **Next-Step Suggestions**: 2-3 logical next steps for the researcher to take.

CITATION RULES:
- Never invent a DOI, PMID, or source URL. 
- If you cannot cite a claim using the provided artifact data or Google Search Grounding, say "No citation available from retrieved sources."
- For researchers, rely purely on the metadata provided in the artifacts.
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
