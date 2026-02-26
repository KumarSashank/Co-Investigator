/**
 * Utility to fetch and parse data from the PubTator REST API.
 */

export interface PubTatorAnnotation {
    pmid: string;
    start: number;
    end: number;
    text: string;
    type: string;
    conceptId: string;
}

export interface PubTatorResponse {
    pmid: string;
    title: string;
    abstract: string;
    annotations: PubTatorAnnotation[];
}

/**
 * Searches PubTator for a specific string (like an article title).
 */
export async function queryPubTatorByTitle(query: string): Promise<PubTatorResponse> {
    // Step 1: Find the target PMID using PubMed API
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json`;
    const pubmedRes = await fetch(searchUrl);

    if (!pubmedRes.ok) {
        throw new Error('Failed to query PubMed API');
    }

    const pubmedData = await pubmedRes.json();
    const pmid = pubmedData.esearchresult?.idlist?.[0];

    if (!pmid) {
        throw new Error(`No PubMed article found for query: "${query}"`);
    }

    return fetchPubTatorAnnotations(pmid);
}

/**
 * Fetches PubTator annotations for a list of PMIDs.
 */
export async function fetchPubTatorAnnotations(pmid: string): Promise<PubTatorResponse> {
    const pubtatorUrl = `https://www.ncbi.nlm.nih.gov/research/pubtator-api/publications/export/pubtator?pmids=${pmid}`;
    const pubtatorRes = await fetch(pubtatorUrl);

    if (!pubtatorRes.ok) {
        throw new Error('Failed to query PubTator API');
    }

    const rawText = await pubtatorRes.text();

    const lines = rawText.split('\n');
    const annotations: PubTatorAnnotation[] = [];
    let title = '';
    let abstract = '';

    for (const line of lines) {
        if (!line.trim()) continue;

        if (line.includes('|t|')) {
            title = line.split('|t|')[1]?.trim() || '';
        } else if (line.includes('|a|')) {
            abstract = line.split('|a|')[1]?.trim() || '';
        } else {
            const parts = line.split('\t');
            if (parts.length >= 6) {
                annotations.push({
                    pmid: parts[0],
                    start: parseInt(parts[1], 10),
                    end: parseInt(parts[2], 10),
                    text: parts[3],
                    type: parts[4],
                    conceptId: parts[5],
                });
            }
        }
    }

    return {
        pmid,
        title,
        abstract,
        annotations,
    };
}
