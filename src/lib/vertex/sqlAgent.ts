import { VertexAI, FunctionDeclaration, Type } from '@google-cloud/vertexai';
import { logger } from '../logger';

const LOG = '🗄️ [SQL Agent]';

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
        temperature: 0.1, // Very low temperature for highly deterministic SQL
        responseMimeType: 'application/json',
    }
});

const SYSTEM_INSTRUCTION = `
You are an **Expert GoogleSQL Data Engineer**.
You are part of the Co-Investigator platform, translating biomedical research questions into precise GoogleSQL queries.

You will be given:
1. The **exact schema** of a specific target BigQuery table.
2. A **natural language intent** describing what data to extract from that table.
3. The **original research query** for broad context.

YOUR JOB:
Generate the exact GoogleSQL query to fulfill the user's intent based ONLY on the provided schema.

RULES:
1. ONLY USE THE COLUMNS PROVIDED IN THE SCHEMA. Do not hallucinate columns.
2. ALWAYS return the \`id\` or primary identifier column for the entity, alongside the requested data.
3. Limit queries to a reasonable number of rows (e.g. \`LIMIT 50\` or \`LIMIT 20\`), unless aggregations are requested.
4. If the intent contains specific disease names or drug names, use \`LOWER()\` and \`) LIKE '%keyword%'\` for fuzzy matching if an exact ID is not provided.
5. Your output MUST be strictly a JSON object with a single \`sql\` string field.

Example output:
{
  "sql": "SELECT id, approvedSymbol, approvedName FROM \`open-targets-prod.platform.target\` WHERE LOWER(approvedName) LIKE '%fibrosis%' LIMIT 10"
}
`;

export async function generateDynamicSQL(
    tableName: string,
    schemaDefinition: any[],
    userIntent: string,
    originalQuery: string
): Promise<string> {
    const startTime = Date.now();
    logger.info(`${LOG} ✍️ Drafting SQL query for ${tableName}`);
    logger.info(`${LOG}    Intent: "${userIntent}"`);

    const requestBody = {
        contents: [{
            role: 'user' as const,
            parts: [
                { text: `=== TABLE NAME ===\n${tableName}` },
                { text: `=== TABLE SCHEMA ===\n${JSON.stringify(schemaDefinition, null, 2)}` },
                { text: `=== ORIGINAL RESEARCH QUERY ===\n${originalQuery}` },
                { text: `=== INTENT ===\nWrite the GoogleSQL query for: ${userIntent}` }
            ]
        }],
        systemInstruction: { role: 'system' as const, parts: [{ text: SYSTEM_INSTRUCTION }] }
    };

    try {
        const response = await generativeModel.generateContent(requestBody);
        const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Vertex AI returned empty response');
        }

        const parsed = JSON.parse(text);
        if (!parsed.sql) {
            throw new Error('AI output missing "sql" string');
        }

        const sql = parsed.sql.replace(/```sql/g, '').replace(/```/g, '').trim();
        logger.info(`${LOG} ✅ Generated SQL in ${Date.now() - startTime}ms:\n   ${sql}`);

        return sql;

    } catch (error: any) {
        logger.error(`${LOG} ❌ SQL Generation Failed: ${error.message}`);
        throw error;
    }
}
