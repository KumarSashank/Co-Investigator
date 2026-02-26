import { PubMedArticleResponse } from './types';

const LOG_PREFIX = '📄 [PubMed]';

export async function fetchFromPubMed(query: string): Promise<PubMedArticleResponse[]> {
    console.log(`${LOG_PREFIX} Searching for: "${query}"`);

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=5`;
    console.log(`${LOG_PREFIX} Search URL: ${searchUrl}`);

    try {
        const searchRes = await fetch(searchUrl);
        console.log(`${LOG_PREFIX} Search response status: ${searchRes.status}`);

        if (!searchRes.ok) throw new Error(`PubMed search failed with status ${searchRes.status}`);
        const searchData = await searchRes.json();

        const idList = searchData.esearchresult?.idlist || [];
        console.log(`${LOG_PREFIX} Found ${idList.length} article IDs: [${idList.join(', ')}]`);

        if (idList.length === 0) {
            console.warn(`${LOG_PREFIX} ⚠️ No articles found for: "${query}"`);
            return [];
        }

        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
        console.log(`${LOG_PREFIX} Fetching summaries...`);
        const summaryRes = await fetch(summaryUrl);
        console.log(`${LOG_PREFIX} Summary response status: ${summaryRes.status}`);

        if (!summaryRes.ok) throw new Error(`PubMed summary failed with status ${summaryRes.status}`);
        const summaryData = await summaryRes.json();

        const articles: PubMedArticleResponse[] = [];

        for (const id of idList) {
            const pData = summaryData.result[id];
            if (pData) {
                articles.push({
                    pmid: pData.uid,
                    title: pData.title,
                    abstract: "Abstract requires efetch endpoint (skipped for performance).",
                    publicationDate: pData.pubdate || pData.epubdate,
                    authors: pData.authors ? pData.authors.map((a: any) => a.name) : []
                });
            }
        }

        console.log(`${LOG_PREFIX} ✅ Parsed ${articles.length} articles:`);
        articles.forEach((a, i) => {
            console.log(`${LOG_PREFIX}    ${i + 1}. "${a.title.substring(0, 80)}..." (${a.publicationDate})`);
        });

        return articles;
    } catch (error) {
        console.error(`${LOG_PREFIX} ❌ FAILED:`, error instanceof Error ? error.message : error);
        console.warn(`${LOG_PREFIX} ⚠️ Returning FALLBACK data`);
        return [
            {
                pmid: "FALLBACK",
                title: `⚠️ PubMed API failed for "${query}" — check terminal logs`,
                abstract: "The PubMed E-utilities API call failed. Check the terminal for the full error.",
                publicationDate: "N/A",
                authors: ["Fallback"]
            }
        ];
    }
}
