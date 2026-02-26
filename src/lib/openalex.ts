import { OpenAlexAuthorResponse } from './types';

const LOG_PREFIX = '🔬 [OpenAlex]';

/**
 * Fetches author data from OpenAlex.
 * Smart routing: if the input looks like a research query (contains spaces + common words),
 * it searches by topic/concept first, then finds the top author.
 * If it looks like an author name, it searches directly.
 */
export async function fetchAuthorFromOpenAlex(searchTerm: string): Promise<OpenAlexAuthorResponse> {
    console.log(`${LOG_PREFIX} Input: "${searchTerm}"`);

    // Detect if this is a research query vs an actual author name
    const queryWords = ['find', 'search', 'experts', 'published', 'research', 'treatment', 'disease', 'study', 'who', 'what', 'how'];
    const isResearchQuery = queryWords.some(w => searchTerm.toLowerCase().includes(w)) || searchTerm.split(' ').length > 4;

    if (isResearchQuery) {
        console.log(`${LOG_PREFIX} Detected research query — searching by topic/works instead of author name`);
        return searchByTopic(searchTerm);
    } else {
        console.log(`${LOG_PREFIX} Detected author name — searching directly`);
        return searchByAuthorName(searchTerm);
    }
}

/**
 * Searches OpenAlex works by topic to find the most prolific author.
 */
async function searchByTopic(query: string): Promise<OpenAlexAuthorResponse> {
    // Extract meaningful keywords (remove common research query words)
    const stopWords = ['find', 'search', 'for', 'experts', 'on', 'who', 'have', 'published', 'the', 'in', 'last', 'years', 'a', 'an', 'about', 'research', 'researchers'];
    const keywords = query.split(/\s+/)
        .filter(w => !stopWords.includes(w.toLowerCase()) && w.length > 2)
        .join(' ');
    console.log(`${LOG_PREFIX} Extracted keywords: "${keywords}"`);

    const worksUrl = `https://api.openalex.org/works?search=${encodeURIComponent(keywords)}&sort=cited_by_count:desc&per_page=10`;
    console.log(`${LOG_PREFIX} Works search URL: ${worksUrl}`);

    try {
        const res = await fetch(worksUrl, {
            headers: { 'User-Agent': 'benchspark-co-investigator/1.0 (mailto:benchspark@example.com)' }
        });
        console.log(`${LOG_PREFIX} Works response: ${res.status}`);

        if (!res.ok) throw new Error(`OpenAlex works search failed: ${res.status}`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            console.warn(`${LOG_PREFIX} ⚠️ No works found for keywords: "${keywords}"`);
            throw new Error('No works found');
        }

        console.log(`${LOG_PREFIX} Found ${data.results.length} works`);

        // Count author appearances to find the most prolific
        const authorCounts: Record<string, { id: string; name: string; count: number; institution: string }> = {};
        for (const work of data.results) {
            for (const authorship of (work.authorships || [])) {
                const author = authorship.author;
                if (author?.id) {
                    if (!authorCounts[author.id]) {
                        authorCounts[author.id] = {
                            id: author.id,
                            name: author.display_name,
                            count: 0,
                            institution: authorship.institutions?.[0]?.display_name || 'Unknown'
                        };
                    }
                    authorCounts[author.id].count++;
                }
            }
        }

        // Sort by frequency
        const topAuthors = Object.values(authorCounts).sort((a, b) => b.count - a.count);
        console.log(`${LOG_PREFIX} Top 5 authors by frequency:`);
        topAuthors.slice(0, 5).forEach((a, i) => {
            console.log(`${LOG_PREFIX}    ${i + 1}. ${a.name} (${a.count} papers) — ${a.institution}`);
        });

        if (topAuthors.length === 0) throw new Error('No authors found in works');

        const topAuthor = topAuthors[0];

        // Fetch full author details
        console.log(`${LOG_PREFIX} Fetching full profile for: ${topAuthor.name} (${topAuthor.id})`);
        const authorUrl = `https://api.openalex.org/authors/${topAuthor.id.replace('https://openalex.org/', '')}`;
        const authorRes = await fetch(authorUrl, {
            headers: { 'User-Agent': 'benchspark-co-investigator/1.0 (mailto:benchspark@example.com)' }
        });

        if (!authorRes.ok) throw new Error(`Author profile fetch failed: ${authorRes.status}`);
        const author = await authorRes.json();

        // Get recent publications
        const recentWorks = data.results
            .filter((w: any) => w.authorships?.some((a: any) => a.author?.id === topAuthor.id))
            .slice(0, 5)
            .map((w: any) => ({
                title: w.title || 'Untitled',
                year: w.publication_year || 0,
                citationCount: w.cited_by_count || 0,
            }));

        const result: OpenAlexAuthorResponse = {
            authorId: author.id,
            displayName: author.display_name,
            currentInstitution: author.last_known_institution?.display_name || topAuthor.institution,
            metrics: {
                worksCount: author.works_count || 0,
                citedByCount: author.cited_by_count || 0,
                hIndex: author.summary_stats?.h_index || 0,
            },
            recentPublications: recentWorks.length > 0 ? recentWorks : [
                { title: 'No recent publications found', year: 2025, citationCount: 0 }
            ]
        };

        console.log(`${LOG_PREFIX} ✅ Result: ${result.displayName} at ${result.currentInstitution}`);
        console.log(`${LOG_PREFIX}    h-index: ${result.metrics.hIndex}, citations: ${result.metrics.citedByCount}, works: ${result.metrics.worksCount}`);
        return result;

    } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Topic search failed:`, error instanceof Error ? error.message : error);
        return getFallback(query);
    }
}

/**
 * Searches OpenAlex by author name directly.
 */
async function searchByAuthorName(authorName: string): Promise<OpenAlexAuthorResponse> {
    const url = `https://api.openalex.org/authors?search=${encodeURIComponent(authorName)}`;
    console.log(`${LOG_PREFIX} Author search URL: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'benchspark-co-investigator/1.0 (mailto:benchspark@example.com)' }
        });
        console.log(`${LOG_PREFIX} Response: ${res.status}`);

        if (!res.ok) throw new Error(`OpenAlex API: ${res.status}`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            console.warn(`${LOG_PREFIX} ⚠️ No author found for: "${authorName}"`);
            throw new Error('No author found');
        }

        const author = data.results[0];
        console.log(`${LOG_PREFIX} ✅ Found: ${author.display_name}`);

        // Fetch recent works
        let recentPublications: Array<{ title: string; year: number; citationCount: number }> = [];
        try {
            const worksUrl = `https://api.openalex.org/works?filter=author.id:${author.id}&sort=publication_year:desc&per_page=5`;
            const worksRes = await fetch(worksUrl, {
                headers: { 'User-Agent': 'benchspark-co-investigator/1.0 (mailto:benchspark@example.com)' }
            });
            if (worksRes.ok) {
                const worksData = await worksRes.json();
                recentPublications = (worksData.results || []).map((w: any) => ({
                    title: w.title || 'Untitled',
                    year: w.publication_year || 0,
                    citationCount: w.cited_by_count || 0,
                }));
            }
        } catch {
            console.warn(`${LOG_PREFIX} ⚠️ Failed to fetch works`);
        }

        return {
            authorId: author.id,
            displayName: author.display_name,
            currentInstitution: author.last_known_institution?.display_name || 'Unknown Institution',
            metrics: {
                worksCount: author.works_count || 0,
                citedByCount: author.cited_by_count || 0,
                hIndex: author.summary_stats?.h_index || 0,
            },
            recentPublications: recentPublications.length > 0 ? recentPublications : [
                { title: 'No publications fetched', year: 2025, citationCount: 0 }
            ]
        };
    } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Author search failed:`, error instanceof Error ? error.message : error);
        return getFallback(authorName);
    }
}

function getFallback(query: string): OpenAlexAuthorResponse {
    console.warn(`${LOG_PREFIX} ⚠️ Returning FALLBACK data`);
    return {
        authorId: "https://openalex.org/FALLBACK",
        displayName: query,
        currentInstitution: "⚠️ Fallback — OpenAlex search failed",
        metrics: { worksCount: 0, citedByCount: 0, hIndex: 0 },
        recentPublications: [
            { title: "OpenAlex API search failed — check terminal logs", year: 2025, citationCount: 0 }
        ]
    };
}
