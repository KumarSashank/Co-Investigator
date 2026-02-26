import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { SubTask } from '@/lib/types';
import { createSession } from '@/lib/firestore/stateEngine';

// Initialize Vertex AI
const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: {
        responseMimeType: 'application/json',
    }
});

/**
 * POST /api/agent/plan
 * Takes a user research query and returns a synthesized execution plan.
 * Persists the session in Firestore.
 */
export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Research query is required' }, { status: 400 });
        }

        const systemInstruction = `
      You are a high-level preclinical research intern (Co-Investigator).
      Your job is to break down complex research queries into 2-4 executable sub-tasks.
      
      You have access to the following tool categories:
      1. 'bigquery' - For querying public biomedical data (ClinGen, CIViC, Reactome).
      2. 'openalex' - For finding researcher citation and publication metrics.
      3. 'pubmed' - For fetching recent biomedical literature and abstracts.
      4. 'pubtator' - For finding specific biomedical entity annotations (PMID-based).
      5. 'datasets' - For browsing and reading from 14+ GCS datasets:
         - bioRxiv/medRxiv, ClinicalTrials.gov, DepMap (Cancer), GTEx (Expressions), 
           Human Protein Atlas, ORKG, Pathway Commons, PubMedQA, PubTator 3.0, STRING (Interactions).
      
      6. 'web_search' - For general web searching (Google) to find emerging news, researchers, or diseases that do not appear in any biomedical datasets yet.
      
      Output exactly a JSON array of tasks matching this TypeScript interface:
      Array<{
        id: string; // e.g., "step-1"
        description: string; // e.g., "Query BigQuery for Multiple Sclerosis targets"
        toolToUse: 'bigquery' | 'openalex' | 'pubmed' | 'pubtator' | 'datasets' | 'web_search' | 'none';
        status: 'pending';
      }>

      CRITICAL STRATEGY: 
      If querying for a very rare disease, an emerging drug, or something you suspect is not in curated structured datasets like 'bigquery' (ClinGen/CIViC), you must ALWAYS include a fallback step using either 'pubmed' (for literature) or 'web_search' (to search the broader internet). DO NOT use 'web_search' if the data is likely in standard bio-datasets.
    `;

        const requestBody = {
            contents: [{ role: 'user', parts: [{ text: query }] }],
            systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] }
        };

        const response = await generativeModel.generateContent(requestBody);

        // Safety check parsing
        const candidateText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        let plan: SubTask[] = [];
        try {
            plan = JSON.parse(candidateText);
        } catch (e) {
            console.error("Failed to parse Vertex API response", candidateText);
            return NextResponse.json({ error: 'Failed to generate a valid plan' }, { status: 500 });
        }

        // Persist the session to Firestore
        const sessionId = await createSession(query, plan);

        return NextResponse.json({
            status: 'success',
            sessionId: sessionId,
            plan: plan
        });

    } catch (error: any) {
        console.error('Agent Planning Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
