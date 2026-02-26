import { PubMedArticleResponse } from './types';
import { logger } from './logger';

const LOG_PREFIX = '📄 [PubMed]';

/**
 * Extracts affiliations and the corresponding author email from a single PMID's Medline XML block.
 */
export function extractContactInfoFromXml(xmlText: string, pmid: string): { affiliations: string[], correspondingEmail: string | null } {
    const articleXmlRegex = new RegExp(`<PMID Version="\\d+">${pmid}</PMID>[\\s\\S]*?(?:</PubmedArticle>|$)`, 'i');
    const articleXmlMatch = xmlText.match(articleXmlRegex);
    const articleXml = articleXmlMatch ? articleXmlMatch[0] : '';

    const affiliationRegex = /<Affiliation>(.*?)<\/Affiliation>/g;
    const affiliations = new Set<string>();
    let match;
    while ((match = affiliationRegex.exec(articleXml)) !== null) {
        // Remove HTML-like tags from within affiliation if any
        const cleanAffil = match[1].replace(/<[^>]*>?/gm, '').trim();
        if (cleanAffil) affiliations.add(cleanAffil);
    }

    // Extract emails (often at the end of an affiliation string)
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    let correspondingEmail: string | null = null;

    for (const affil of affiliations) {
        const emailMatch = affil.match(emailRegex);
        if (emailMatch && emailMatch.length > 0) {
            correspondingEmail = emailMatch[0]; // Take the first email found
            break;
        }
    }

    return { affiliations: Array.from(affiliations), correspondingEmail };
}

/**
 * pubmed_search(query, from_year?, to_year?)
 * Returns PMIDs + metadata for a given search query matching DeepResearch specs.
 */
export async function pubmed_search(query: string, from_year?: number, to_year?: number): Promise<string[]> {
    logger.info({ query, from_year, to_year }, `${LOG_PREFIX} pubmed_search called`);

    // Construct date string if provided
    let dateFilter = '';
    if (from_year && to_year) {
        dateFilter = ` AND ("${from_year}/01/01"[Date - Publication] : "${to_year}/12/31"[Date - Publication])`;
    } else if (from_year) {
        dateFilter = ` AND ("${from_year}/01/01"[Date - Publication] : "3000"[Date - Publication])`;
    }

    const fullQuery = `${query}${dateFilter}`;
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(fullQuery)}&retmode=json&retmax=20`;

    logger.debug(`${LOG_PREFIX} Search URL: ${searchUrl}`);

    try {
        const searchRes = await fetch(searchUrl);
        if (!searchRes.ok) throw new Error(`PubMed search failed with status ${searchRes.status}`);

        const searchData = await searchRes.json();
        const idList: string[] = searchData.esearchresult?.idlist || [];

        logger.info(`${LOG_PREFIX} Found ${idList.length} PMIDs`);
        return idList;
    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, `${LOG_PREFIX} Search failed`);
        throw new Error(`pubmed_search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * pubmed_fetch(pmids)
 * Returns detailed records including authors, affiliations, and corresponding author emails.
 */
export async function pubmed_fetch(pmids: string[]): Promise<PubMedArticleResponse[]> {
    if (!pmids || pmids.length === 0) return [];

    logger.info({ pmidCount: pmids.length }, `${LOG_PREFIX} pubmed_fetch called for [${pmids.slice(0, 3).join(',')}...]`);

    // Fetch summaries first for basic metadata (titles, pub dates)
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;

    // Fetch full XML for affiliations and emails (JSON E-utilities doesn't reliably include full affiliations/emails)
    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;

    try {
        const [summaryRes, fetchRes] = await Promise.all([
            fetch(summaryUrl),
            fetch(efetchUrl)
        ]);

        if (!summaryRes.ok) throw new Error(`PubMed summary failed: ${summaryRes.status}`);
        if (!fetchRes.ok) throw new Error(`PubMed efetch failed: ${fetchRes.status}`);

        const summaryData = await summaryRes.json();
        const xmlText = await fetchRes.text();

        const articles: PubMedArticleResponse[] = [];

        for (const id of pmids) {
            const pData = summaryData.result?.[id];
            if (!pData) continue;

            const { affiliations, correspondingEmail } = extractContactInfoFromXml(xmlText, id);

            articles.push({
                pmid: id,
                title: pData.title || `Untitled ${id}`,
                abstract: "Abstract available in XML but skipped for payload size. Grounding handles synthesis.",
                publicationDate: pData.pubdate || pData.epubdate || 'Unknown',
                authors: pData.authors ? pData.authors.map((a: any) => a.name) : [],
                affiliations,
                correspondingEmail
            });
        }

        logger.info(`${LOG_PREFIX} ✅ Fetched and parsed ${articles.length} detailed articles`);
        return articles;

    } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : error }, `${LOG_PREFIX} Fetch failed`);
        throw new Error(`pubmed_fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
