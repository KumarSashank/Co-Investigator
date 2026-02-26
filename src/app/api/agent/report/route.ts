import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { getSession, updateSession } from '@/lib/firestore/stateEngine';

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-hackathon-default',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash'
});

/**
 * POST /api/agent/report
 * Final ReAct step: Synthesizes all gathered tool data into a final markdown Research Brief.
 */
export async function POST(req: Request) {
    try {
        const { sessionId } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // Prepare the context for the LLM by combining all successful tool outputs
        const contextData = session.plan
            .filter(t => t.status === 'completed' && t.resultData)
            .map(t => `\n--- Output from ${t.toolToUse} ---\n${JSON.stringify(t.resultData, null, 2)}`)
            .join('\n');

        const systemInstruction = `
      You are a high-level preclinical research intern. 
      You have executed a research plan for the query: "${session.originalQuery}".
      
      Using ONLY the gathered tool data below, write a structured, highly professional 
      Markdown "Research Brief". Do not hallucinate external facts. 
      Format the markdown beautifully with headers, bullet points, and highlight key researchers.
    `;

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: `Here is the gathered data:\n${contextData}` }] }],
            systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
        };

        const response = await generativeModel.generateContent(requestBody);
        const finalMarkdown = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate report.";

        // Save the final report to Firestore
        await updateSession(sessionId, {
            finalReportMarkdown: finalMarkdown,
            status: 'completed'
        });

        return NextResponse.json({
            status: 'success',
            markdown: finalMarkdown,
            // For hackathon purposes, we mock a high grounding score to show the UI
            // In production, you would call the Vertex AI Grounding/Check Grounding API
            groundingScore: 0.92
        });

    } catch (error: any) {
        console.error('Agent Report Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
