import { VertexAI } from '@google-cloud/vertexai';
import { logger } from '@/lib/logger';
import { withVertexRetry } from '@/lib/vertex/retry';

/**
 * Step-Level Specialist Agent
 * 
 * After each tool returns raw JSON data, this agent makes a SECOND Gemini call
 * to reason about the data, extract insights, and produce a structured summary
 * that gets passed to the next agent in the pipeline.
 * 
 * This is the core of the multi-agent architecture:
 *   Planner Agent → [Specialist Agent per step] → Synthesizer Agent
 */

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986',
    location: 'us-central1'
});

const agentModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.0-flash', // Fast model for per-step reasoning
    generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 4096,
    }
});

const LOG = '🧬 [StepAgent]';

/**
 * Specialist prompts keyed by step intent.
 * Each specialist "agent" has domain expertise.
 */
const SPECIALIST_PROMPTS: Record<string, string> = {
    retrieve: `You are a **Disease & Target Grounding Specialist Agent**.
You have just received raw data from a biomedical database query.
Your job is to:
1. Identify the TOP 5 most clinically relevant targets or pathways from this data.
2. For each target, explain WHY it matters for the disease in 1-2 sentences.
3. Suggest which targets should be investigated further via literature search.
4. Flag any surprising or novel findings.

Output a JSON object:
{
  "agent_name": "Disease Grounding Specialist",
  "key_targets": [{"name": "...", "relevance": "...", "evidence_score": 0.0, "investigate_further": true}],
  "disease_summary": "2-3 sentence synthesis",
  "suggested_search_terms": ["term1", "term2"],
  "confidence": "HIGH|MEDIUM|LOW"
}`,

    rank: `You are a **Research Impact Analyst Agent**.
You have just received researcher profiles and publication metrics.
Your job is to:
1. Rank the researchers by RELEVANCE to the original query (not just raw citation count).
2. For each researcher, write a 1-2 sentence "relevance justification" connecting their work to the query.
3. Identify the TOP 3 most promising collaborators.
4. Flag researchers who are actively publishing (last 2 years) vs. legacy names.

Output a JSON object:
{
  "agent_name": "Research Impact Analyst",
  "ranked_researchers": [{"name": "...", "institution": "...", "relevance_score": 0.0, "justification": "...", "active": true, "key_topic_overlap": ["topic1"]}],
  "top_3_collaborator_picks": ["name1", "name2", "name3"],
  "field_trend": "1-2 sentence observation about the field",
  "confidence": "HIGH|MEDIUM|LOW"
}`,

    verify: `You are a **Activity Verification Agent**.
You have just received detailed author profiles and their recent publication timelines.
Your job is to:
1. Cross-reference publication dates to verify each researcher's activity level in the last 3 years.
2. Identify which researchers have SHIFTED topics away from the query area.
3. Flag any researchers whose recent work is highly relevant but citation count is low (rising stars).
4. Produce a verified activity report.

Output a JSON object:
{
  "agent_name": "Activity Verification Agent",
  "verified_profiles": [{"name": "...", "status": "ACTIVE|DECLINING|RISING_STAR|SHIFTED_TOPIC", "last_relevant_pub_year": 2024, "recent_relevant_count": 5, "notes": "..."}],
  "rising_stars": ["name1"],
  "topic_shifters": ["name2"],
  "confidence": "HIGH|MEDIUM|LOW"
}`,

    extract: `You are a **Contact & Affiliation Extraction Agent**.
You have just received detailed PubMed article metadata.
Your job is to:
1. Extract corresponding author emails when available.
2. Map author names to their most recent institutional affiliations.
3. Identify the best contact pathway for each researcher (direct email > institutional page > lab website).
4. Flag any authors where no contact info could be found.

Output a JSON object:
{
  "agent_name": "Contact Extraction Agent",
  "contacts": [{"name": "...", "email": "...", "institution": "...", "department": "...", "contact_method": "direct_email|institutional|not_found", "source_pmid": "..."}],
  "emails_found": 0,
  "emails_missing": 0,
  "confidence": "HIGH|MEDIUM|LOW"
}`,

    synthesize: `You are a **Cross-Reference Synthesis Agent**.
You have received data from multiple upstream agents.
Your job is to:
1. Combine disease target data with researcher profiles.
2. Identify which researchers work on which specific targets.
3. Create a target-researcher mapping matrix.
4. Highlight gaps (targets with no identified active researchers).

Output a JSON object:
{
  "agent_name": "Cross-Reference Synthesis Agent",
  "target_researcher_map": [{"target": "...", "researchers": ["name1", "name2"], "coverage": "WELL_COVERED|SPARSE|GAP"}],
  "key_insight": "1-2 sentence top finding",
  "gaps_identified": ["description of gap"],
  "confidence": "HIGH|MEDIUM|LOW"
}`,
};

/**
 * Run the step-level specialist agent.
 * This is called AFTER the tool executes, BEFORE saving results.
 */
export async function runStepAgent(
    stepIntent: string,
    rawToolData: Record<string, any>,
    previousAnalyses: Record<string, any>,
    originalQuery: string
): Promise<any> {
    const specialistPrompt = SPECIALIST_PROMPTS[stepIntent] || SPECIALIST_PROMPTS['synthesize'];

    const contextMessage = `
ORIGINAL RESEARCH QUERY: "${originalQuery}"

RAW TOOL OUTPUT (from this step):
${JSON.stringify(rawToolData, null, 2).slice(0, 15000)}

ANALYSES FROM PREVIOUS AGENTS IN THE PIPELINE:
${Object.keys(previousAnalyses).length > 0
            ? JSON.stringify(previousAnalyses, null, 2).slice(0, 10000)
            : "No previous agent analyses available yet. You are the first agent in the pipeline."}

Now perform your specialist analysis.
`;

    try {
        logger.info(`${LOG} 🧬 Running ${stepIntent} specialist agent...`);

        const response = await withVertexRetry(`${stepIntent} Agent Analysis`, () => agentModel.generateContent({
            contents: [{ role: 'user', parts: [{ text: contextMessage }] }],
            systemInstruction: { role: 'system' as const, parts: [{ text: specialistPrompt }] }
        }));

        const analysisText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

        let analysis;
        try {
            analysis = JSON.parse(analysisText);
        } catch {
            logger.warn(`${LOG} ⚠️ Could not parse agent response as JSON, wrapping as text`);
            analysis = { agent_name: `${stepIntent}_agent`, raw_analysis: analysisText, confidence: 'LOW' };
        }

        logger.info(`${LOG} ✅ ${stepIntent} agent completed. Confidence: ${analysis.confidence || 'N/A'}`);
        return analysis;

    } catch (error: any) {
        logger.error(`${LOG} ❌ Step agent failed: ${error.message}`);
        return {
            agent_name: `${stepIntent}_agent_fallback`,
            error: error.message,
            confidence: 'FAILED'
        };
    }
}
