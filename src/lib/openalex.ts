import { OpenAlexAuthorResponse, ActivityLevel } from './types';
import { logger } from './logger';

const LOG_PREFIX = '🔬 [OpenAlex]';

/**
 * Normalizes a purely numeric value against an assumed max scale (e.g., 100 for works, 10k for citations)
 * Ensures standard 0-1 range for the scoring algorithm.
 */
export function normalize(val: number, assumedMax: number): number {
    return Math.min(val / assumedMax, 1.0);
}

/**
 * Calculates a recency score. 
 * Current year gets 1.0, minus 0.2 for each year older.
 */
export function calculateRecencyScore(lastYear: number, currentYear: number = new Date().getFullYear()): number {
    if (lastYear === 0) return 0;
    const diff = currentYear - lastYear;
    return Math.max(1.0 - (diff * 0.2), 0);
}

/**
 * Determines exact activity level based on DeepResearch requirement:
 * ACTIVE: >=3 relevant works in last 3 years OR last relevant work within 12 months
 * MODERATE: 1–2 relevant works in last 3 years OR last relevant work within 24 months
 * LOW: none in last 3 years OR last relevant work older than 24 months
 */
export function determineActivityLevel(worksLast3Years: number, lastWorkYear: number, currentYear: number = new Date().getFullYear()): ActivityLevel {
    const monthsSinceLastWork = (currentYear - lastWorkYear) * 12;

    if (worksLast3Years >= 3 || monthsSinceLastWork <= 12) {
        return 'ACTIVE';
    } else if ((worksLast3Years >= 1 && worksLast3Years <= 2) || monthsSinceLastWork <= 24) {
        return 'MODERATE';
    }
    return 'LOW';
}


/**
 * openalex_search_authors(query, from_year?, to_year?, keywords?)
 * Returns candidate researchers with ids, works_count, cited_by_count, recent_works.
 * IMPORTANT: The AI planner generates proper API-ready queries. This function trusts them.
 */
export async function openalex_search_authors(query: string, from_year?: number, to_year?: number, keywords?: string[]): Promise<OpenAlexAuthorResponse[]> {
    logger.info({ query, from_year, to_year, keywords }, `${LOG_PREFIX} openalex_search_authors called`);

    // Use keywords if provided by the planner, otherwise use query directly
    const kwArray = Array.isArray(keywords) ? keywords : (typeof keywords === 'string' ? [keywords] : []);
    const searchTerms = kwArray.length > 0
        ? kwArray.join(' ')
        : query;

    // Build the URL with proper filters
    let url = `https://api.openalex.org/works?search=${encodeURIComponent(searchTerms)}&sort=cited_by_count:desc&per_page=50`;

    // Add year filter if provided
    if (from_year) {
        url += `&filter=publication_year:>${from_year - 1}`;
    }

    logger.info(`${LOG_PREFIX} Search URL: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'benchspark-co-investigator/2.0 (mailto:benchspark@example.com)' }
        });

        if (!res.ok) throw new Error(`OpenAlex works search failed: ${res.status}`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            logger.warn(`${LOG_PREFIX} No works found for: "${searchTerms}"`);
            return [];
        }

        logger.info(`${LOG_PREFIX} Found ${data.results.length} works for "${searchTerms}"`);

        // Aggregate Authors from these papers
        const authorMap = new Map<string, any>();
        const currentYear = new Date().getFullYear();

        for (const work of data.results) {
            const pubYear = work.publication_year || 0;
            for (const authorship of (work.authorships || [])) {
                const author = authorship.author;
                if (!author?.id) continue;

                if (!authorMap.has(author.id)) {
                    authorMap.set(author.id, {
                        ...author,
                        institution: authorship.institutions?.[0]?.display_name || 'Unknown',
                        localWorksCount: 0,
                        recentWorks: []
                    });
                }

                const entry = authorMap.get(author.id);
                entry.localWorksCount++;
                entry.recentWorks.push({
                    title: work.title,
                    year: pubYear,
                    citationCount: work.cited_by_count || 0,
                    doi: work.doi || null,
                    url: work.id || ''
                });
            }
        }

        const candidates: OpenAlexAuthorResponse[] = [];
        for (const [id, entry] of Array.from(authorMap.entries()).slice(0, 15)) {
            const worksLast3Years = entry.recentWorks.filter((w: any) => w.year >= currentYear - 3).length;
            const lastWorkYear = entry.recentWorks.reduce((max: number, w: any) => Math.max(max, w.year), 0);
            const estimatedCitations = entry.recentWorks.reduce((sum: number, w: any) => sum + w.citationCount, 0);

            const score =
                (0.45 * normalize(worksLast3Years, 10)) +
                (0.35 * normalize(estimatedCitations, 1000)) +
                (0.20 * calculateRecencyScore(lastWorkYear, currentYear));

            const activityLevel = determineActivityLevel(worksLast3Years, lastWorkYear, currentYear);

            // Build profile URL from author ID
            const profileUrl = id.startsWith('https://') ? id : `https://openalex.org/${id}`;

            candidates.push({
                authorId: id,
                displayName: entry.display_name,
                profileUrl,
                currentInstitution: entry.institution,
                metrics: {
                    worksCount: entry.localWorksCount,
                    citedByCount: estimatedCitations,
                    hIndex: 0
                },
                score: parseFloat(score.toFixed(3)),
                activityLevel,
                lastRelevantWorkYear: lastWorkYear,
                recentPublications: entry.recentWorks.slice(0, 3)
            });
        }

        candidates.sort((a, b) => b.score - a.score);

        // Log top candidates
        for (const c of candidates.slice(0, 5)) {
            logger.info(`${LOG_PREFIX}   📊 ${c.displayName} (${c.currentInstitution}) — score: ${c.score}, activity: ${c.activityLevel}`);
        }

        logger.info(`${LOG_PREFIX} ✅ Returns ${candidates.length} ranked candidate authors`);
        return candidates;

    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, `${LOG_PREFIX} Searching authors failed`);
        throw error;
    }
}

/**
 * openalex_get_author(author_id)
 * Returns full author profile + affiliations + complete works timeline.
 * Accepts OpenAlex full URL or short ID (e.g. A5091359268)
 */
export async function openalex_get_author(authorId: string): Promise<OpenAlexAuthorResponse> {
    logger.info({ authorId }, `${LOG_PREFIX} openalex_get_author called`);

    // Handle various ID formats: full URL, short ID, or just the numeric part
    let cleanId = authorId;
    if (authorId.startsWith('https://openalex.org/')) {
        cleanId = authorId.replace('https://openalex.org/', '');
    } else if (!authorId.startsWith('A') && /^\d+$/.test(authorId)) {
        cleanId = `A${authorId}`;
    }

    const url = `https://api.openalex.org/authors/${cleanId}`;
    logger.info(`${LOG_PREFIX} Fetching author profile: ${url}`);

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'benchspark-co-investigator/2.0 (mailto:benchspark@example.com)' }
        });

        if (!res.ok) {
            logger.error(`${LOG_PREFIX} ❌ Author API returned ${res.status} for ID: "${authorId}" (cleaned: "${cleanId}")`);
            throw new Error(`OpenAlex author fetch failed: ${res.status} for ID "${cleanId}"`);
        }
        const author = await res.json();

        logger.info(`${LOG_PREFIX} ✅ Found author: ${author.display_name} (${author.last_known_institution?.display_name || 'Unknown'})`);

        // Fetch their specific works to calculate custom scoring
        const worksUrl = `https://api.openalex.org/works?filter=author.id:${cleanId}&sort=publication_year:desc&per_page=15`;
        const worksRes = await fetch(worksUrl, {
            headers: { 'User-Agent': 'benchspark-co-investigator/2.0 (mailto:benchspark@example.com)' }
        });
        const worksData = worksRes.ok ? await worksRes.json() : { results: [] };

        const currentYear = new Date().getFullYear();
        let worksLast3Years = 0;
        let lastWorkYear = 0;
        const recentPublications = [];

        for (const w of (worksData.results || [])) {
            const year = w.publication_year || 0;
            if (year >= currentYear - 3) worksLast3Years++;
            if (year > lastWorkYear) lastWorkYear = year;

            recentPublications.push({
                title: w.title,
                year,
                citationCount: w.cited_by_count || 0,
                doi: w.doi || null,
                url: w.id || ''
            });
        }

        const score =
            (0.45 * normalize(worksLast3Years, 10)) +
            (0.35 * normalize(author.cited_by_count || 0, 50000)) +
            (0.20 * calculateRecencyScore(lastWorkYear, currentYear));

        const activityLevel = determineActivityLevel(worksLast3Years, lastWorkYear, currentYear);

        // Build profile URL
        const profileUrl = author.id?.startsWith('https://') ? author.id : `https://openalex.org/${cleanId}`;

        return {
            authorId: author.id,
            displayName: author.display_name,
            profileUrl,
            currentInstitution: author.last_known_institution?.display_name || 'Unknown',
            metrics: {
                worksCount: author.works_count || 0,
                citedByCount: author.cited_by_count || 0,
                hIndex: author.summary_stats?.h_index || 0,
            },
            score: parseFloat(score.toFixed(3)),
            activityLevel,
            lastRelevantWorkYear: lastWorkYear,
            recentPublications: recentPublications.slice(0, 5)
        };

    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, `${LOG_PREFIX} Get author failed`);
        throw error;
    }
}
