import { logger } from '@/lib/logger';

/**
 * Vertex AI Search (Discovery Engine) Integration
 * 
 * Uses @google-cloud/discoveryengine to perform grounded search
 * against a Vertex AI Search datastore. This provides RAG-style
 * retrieval from curated internal knowledge bases.
 * 
 * Configuration:
 *   VERTEX_SEARCH_DATASTORE_ID - The datastore ID in Vertex AI Search
 *   GOOGLE_CLOUD_PROJECT       - GCP project ID
 *   VERTEX_SEARCH_LOCATION     - Region (default: global)
 */

const LOG = '🔍 [VertexSearch]';

// Lazy-loaded client to avoid import failures if the SDK isn't configured
let searchClient: any = null;

async function getSearchClient() {
    if (searchClient) return searchClient;

    try {
        const { SearchServiceClient } = await import('@google-cloud/discoveryengine');
        searchClient = new SearchServiceClient();
        return searchClient;
    } catch (error: any) {
        logger.error(`${LOG} Failed to initialize Discovery Engine client: ${error.message}`);
        throw error;
    }
}

export interface VertexSearchResult {
    title: string;
    snippet: string;
    uri: string;
    relevanceScore: number;
}

export interface VertexSearchResponse {
    query: string;
    results: VertexSearchResult[];
    totalResults: number;
    summary: string | null;
}

/**
 * vertex_search_retrieve(query, filters?)
 * 
 * Performs a search against the configured Vertex AI Search datastore.
 * Returns relevant passages with source IDs, URLs, and snippets.
 */
export async function vertex_search_retrieve(
    query: string,
    filters?: Record<string, string>
): Promise<VertexSearchResponse> {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986';
    const datastoreId = process.env.VERTEX_SEARCH_DATASTORE_ID;
    const location = process.env.VERTEX_SEARCH_LOCATION || 'global';

    logger.info({ query, datastoreId, filters }, `${LOG} vertex_search_retrieve called`);

    if (!datastoreId) {
        logger.warn(`${LOG} ⚠️ No VERTEX_SEARCH_DATASTORE_ID configured. Using Vertex AI Gemini grounded search as fallback.`);
        return await geminiGroundedSearch(query, projectId);
    }

    try {
        const client = await getSearchClient();

        // Build the serving config path
        const servingConfig = client.projectLocationCollectionDataStoreServingConfigPath(
            projectId,
            location,
            'default_collection',
            datastoreId,
            'default_serving_config'
        );

        const request: any = {
            servingConfig,
            query,
            pageSize: 10,
            queryExpansionSpec: { condition: 'AUTO' },
            spellCorrectionSpec: { mode: 'AUTO' },
            contentSearchSpec: {
                snippetSpec: { returnSnippet: true, maxSnippetCount: 3 },
                summarySpec: {
                    summaryResultCount: 5,
                    includeCitations: true,
                },
                extractiveContentSpec: {
                    maxExtractiveAnswerCount: 3,
                    maxExtractiveSegmentCount: 3,
                },
            },
        };

        // Add filter if provided
        if (filters && Object.keys(filters).length > 0) {
            request.filter = Object.entries(filters)
                .map(([key, value]) => `${key}: "${value}"`)
                .join(' AND ');
        }

        logger.info(`${LOG} Querying Vertex AI Search datastore: ${datastoreId}`);

        const [response] = await client.search(request);

        const results: VertexSearchResult[] = [];

        for (const result of response.results || []) {
            const doc = result.document;
            if (!doc) continue;

            // Extract derived data (snippets)
            const snippets = doc.derivedStructData?.snippets || [];
            const snippet = snippets.map((s: any) => s.snippet || '').join(' ').trim();

            // Extract extractive answers
            const extractiveAnswers = doc.derivedStructData?.extractive_answers || [];
            const answerText = extractiveAnswers.map((a: any) => a.content || '').join(' ').trim();

            results.push({
                title: doc.derivedStructData?.title || doc.name || 'Untitled',
                snippet: snippet || answerText || 'No snippet available',
                uri: doc.derivedStructData?.link || doc.name || '',
                relevanceScore: result.relevanceScore || 0,
            });
        }

        // Extract summary if available
        const summary = response.summary?.summaryText || null;

        logger.info(`${LOG} ✅ Found ${results.length} results from Vertex AI Search`);
        if (summary) {
            logger.info(`${LOG} 📝 Summary generated (${summary.length} chars)`);
        }

        return {
            query,
            results,
            totalResults: results.length,
            summary,
        };

    } catch (error: any) {
        logger.error(`${LOG} ❌ Vertex AI Search failed: ${error.message}`);
        logger.warn(`${LOG} Falling back to Gemini grounded search...`);
        return await geminiGroundedSearch(query, projectId);
    }
}

/**
 * Fallback: Use Gemini with Google Search grounding when no datastore is configured.
 * This still provides grounded retrieval, just from the open web instead of a curated datastore.
 */
async function geminiGroundedSearch(query: string, projectId: string): Promise<VertexSearchResponse> {
    const { VertexAI } = await import('@google-cloud/vertexai');

    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1' });
    const model = vertexAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        tools: [{ googleSearch: {} } as any],
    });

    const prompt = `You are a biomedical research assistant. 
Search for and synthesize the most relevant scientific information about: "${query}"

Focus on:
- Key mechanisms and pathways involved
- Recent findings (last 3-5 years)
- Clinical relevance and therapeutic implications
- Important researchers and institutions in this area

Provide a structured summary with specific facts, citing sources where available.`;

    try {
        logger.info(`${LOG} 🌐 Running Gemini grounded search for: "${query}"`);
        const response = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        const text = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Extract grounding metadata if available
        const groundingMetadata = response.response.candidates?.[0]?.groundingMetadata;
        const groundingChunks = (groundingMetadata as any)?.groundingChunks || [];

        const results: VertexSearchResult[] = groundingChunks
            .filter((chunk: any) => chunk.web)
            .map((chunk: any, i: number) => ({
                title: chunk.web.title || `Source ${i + 1}`,
                snippet: chunk.web.title || '',
                uri: chunk.web.uri || '',
                relevanceScore: 1.0 - (i * 0.1),
            }));

        logger.info(`${LOG} ✅ Gemini grounded search returned ${text.length} chars, ${results.length} grounding sources`);

        return {
            query,
            results,
            totalResults: results.length,
            summary: text,
        };
    } catch (error: any) {
        logger.error(`${LOG} ❌ Gemini grounded search also failed: ${error.message}`);
        return {
            query,
            results: [],
            totalResults: 0,
            summary: `Search failed: ${error.message}. The query "${query}" could not be grounded.`,
        };
    }
}
