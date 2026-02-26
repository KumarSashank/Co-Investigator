import { NextResponse } from 'next/server';
import { SubTask } from '@/lib/types';

let vertexAvailable = true;
let generativeModel: any = null;

// Try to initialize Vertex AI (graceful fallback if unavailable)
try {
    const { VertexAI } = require('@google-cloud/vertexai');
    const vertexAI = new VertexAI({
        project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
        location: 'us-central1'
    });
    generativeModel = vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json' }
    });
} catch (e) {
    console.warn('Vertex AI not available, will use fallback planner');
    vertexAvailable = false;
}

/**
 * Smart fallback planner: generates a realistic plan without Vertex AI
 */
function generateFallbackPlan(query: string): SubTask[] {
    const lowerQuery = query.toLowerCase();

    // Detect what the user is looking for and create a relevant plan
    const hasDiseaseKeywords = /cancer|carcinoma|fibrosis|leukemia|melanoma|tumor|disease/i.test(query);
    const hasResearcherKeywords = /researcher|author|expert|scientist|who/i.test(query);
    const hasPublicationKeywords = /publication|paper|study|published|literature/i.test(query);

    const plan: SubTask[] = [];
    let stepNum = 1;

    // Step 1: Always query for disease/target data
    plan.push({
        id: `step-${stepNum++}`,
        description: `Query BigQuery for ${hasDiseaseKeywords ? 'disease-target associations' : 'biomedical data'} related to: ${query}`,
        toolToUse: 'bigquery',
        status: 'pending',
    });

    // Step 2: Search publications
    plan.push({
        id: `step-${stepNum++}`,
        description: `Search PubMed for recent publications on ${query.split(' ').slice(0, 5).join(' ')}`,
        toolToUse: 'pubmed',
        status: 'pending',
    });

    // Step 3: Find researchers if relevant
    if (hasResearcherKeywords || hasPublicationKeywords || hasDiseaseKeywords) {
        plan.push({
            id: `step-${stepNum++}`,
            description: `Identify key researchers and citation metrics via OpenAlex for ${query.split(' ').slice(0, 4).join(' ')}`,
            toolToUse: 'openalex',
            status: 'pending',
        });
    }

    return plan;
}

/**
 * POST /api/agent/plan
 * Takes a user research query and returns a synthesized execution plan.
 * Falls back to smart local planner if Vertex AI is unavailable.
 */
export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Research query is required' }, { status: 400 });
        }

        // Try Vertex AI first
        if (vertexAvailable && generativeModel) {
            try {
                const systemInstruction = `
          You are a high-level preclinical research intern (Co-Investigator).
          Your job is to break down complex research queries into 2-3 executable sub-tasks.
          
          You have access to the following tools:
          1. 'bigquery' - For querying public biomedical data, diseases, and gene targets.
          2. 'openalex' - For finding researcher citation and publication metrics.
          3. 'pubmed' - For fetching recent biomedical literature and abstracts.
          
          Output exactly a JSON array of tasks matching this TypeScript interface:
          Array<{
            id: string;
            description: string;
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
                const plan: SubTask[] = JSON.parse(candidateText);

                return NextResponse.json({ status: 'success', plan });
            } catch (vertexError: any) {
                console.warn('Vertex AI call failed, using fallback planner:', vertexError.message);
                // Fall through to fallback
            }
        }

        // Fallback: smart local planner
        console.log('Using fallback planner for query:', query);
        const plan = generateFallbackPlan(query);

        return NextResponse.json({
            status: 'success',
            plan,
            _fallback: true, // Indicates fallback was used
        });

    } catch (error: any) {
        console.error('Agent Planning Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
