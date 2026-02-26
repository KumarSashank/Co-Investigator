import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';

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
 * POST /api/isolated/debate
 * An isolated module for a Multi-Agent Debate System.
 * Takes a topic and returns a debate between a Proposer and a Skeptic.
 */
export async function POST(req: Request) {
    try {
        const { topic } = await req.json();

        if (!topic) {
            return NextResponse.json({ error: 'Debate topic is required' }, { status: 400 });
        }

        // ==========================================
        // AGENT 1: THE PROPOSER
        // ==========================================
        const proposerPrompt = `
        You are Agent 1: The Proposer. You are a brilliant life sciences researcher.
        The topic is: "${topic}"
        
        Using your extensive knowledge of biology, genetics, and clinical literature, formulate a strong, evidence-based argument SUPPORTING this concept or identifying its most promising potential. 
        Focus on biological mechanisms, potential drug targets, and known interactions.
        
        Return your response strictly as a JSON object: { "proposerArgument": "your detailed argument here" }
        `;

        const proposerRes = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: proposerPrompt }] }]
        });

        let proposerData = { proposerArgument: "Failed to generate argument." };
        try {
            proposerData = JSON.parse(proposerRes.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        } catch (e) { console.error("Proposer JSON failed"); }


        // ==========================================
        // AGENT 2: THE SKEPTIC
        // ==========================================
        const skepticPrompt = `
        You are Agent 2: The Skeptic. You are a rigorous, highly critical peer-reviewer.
        The topic is: "${topic}"
        The Proposer has claimed the following: "${proposerData.proposerArgument}"
        
        Your job is to critically analyze the Proposer's argument. Identify methodological flaws, contradictory evidence in existing literature, potential off-target toxicities, or reasons why this hypothesis might fail in clinical trials. Do not just disagree to disagree; provide rigorous scientific counter-points.
        
        Return your response strictly as a JSON object: { "skepticRebuttal": "your detailed rebuttal here" }
        `;

        const skepticRes = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: skepticPrompt }] }]
        });

        let skepticData = { skepticRebuttal: "Failed to generate rebuttal." };
        try {
            skepticData = JSON.parse(skepticRes.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        } catch (e) { console.error("Skeptic JSON failed"); }


        // ==========================================
        // AGENT 3: THE SYNTHESIS (Judge)
        // ==========================================
        const judgePrompt = `
        You are the Chief Scientific Officer. 
        Topic: "${topic}"
        Proposer argued: "${proposerData.proposerArgument}"
        Skeptic countered: "${skepticData.skepticRebuttal}"
        
        Write a brief, objective 2-sentence conclusion that synthesizes both viewpoints and suggests the immediate next step for laboratory research.
        
        Return your response strictly as a JSON object: { "conclusion": "your synthesis here" }
        `;

        const judgeRes = await generativeModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: judgePrompt }] }]
        });

        let judgeData = { conclusion: "Failed to synthesize." };
        try {
            judgeData = JSON.parse(judgeRes.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        } catch (e) { console.error("Judge JSON failed"); }


        // Combine and return the isolated debate
        return NextResponse.json({
            status: 'success',
            debate: {
                topic,
                proposerArgument: proposerData.proposerArgument,
                skepticRebuttal: skepticData.skepticRebuttal,
                conclusion: judgeData.conclusion
            }
        });

    } catch (error: any) {
        console.error('Isolated Debate Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
