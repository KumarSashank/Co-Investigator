import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { SubTask } from '@/lib/types';

// Initialize Vertex AI
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
        responseMimeType: 'application/json',
    }
});

/**
 * POST /api/agent/plan
 * Takes a user research query and returns a synthesized execution plan.
 */
export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Research query is required' }, { status: 400 });
        }

        const systemInstruction = `
      You are a high-level preclinical research intern (Co-Investigator).
      Your job is to break down complex research queries into 2-3 executable sub-tasks.
      
      You have access to the following tools:
      1. 'bigquery' - For querying public biomedical data, diseases, and gene targets.
      2. 'openalex' - For finding researcher citation and publication metrics.
      3. 'pubmed' - For fetching recent biomedical literature and abstracts.
      
      Output exactly a JSON array of tasks matching this TypeScript interface:
      Array<{
        id: string; // e.g., "step-1"
        description: string; // e.g., "Query BigQuery for NSCLC targets"
        toolToUse: 'bigquery' | 'openalex' | 'pubmed' | 'none';
        status: 'pending';
      }>
    `;

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: query }] }],
            systemInstruction: { role: 'system' as const, parts: [{ text: systemInstruction }] }
        };

        const response = await generativeModel.generateContent(requestBody);

        const candidateText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        let plan: SubTask[] = [];
        try {
            plan = JSON.parse(candidateText);
        } catch (e) {
            console.error("Failed to parse Vertex API response", candidateText);
            return NextResponse.json({ error: 'Failed to generate a valid plan' }, { status: 500 });
        }

        return NextResponse.json({
            status: 'success',
            plan: plan
        });

    } catch (error: any) {
        console.error('Agent Planning Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
