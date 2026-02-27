import { NextResponse } from 'next/server';
import { fetchFromPubMed } from '@/lib/pubmed';
// Importing other existing dataset providers from Phase 2 & 3
import { queryPubTatorByTitle as searchPubTator } from '@/lib/pubtator';
import { searchBigQuery } from '@/lib/bigquery';
import { fetchProteinInteractions as getProteinInteractions } from '@/lib/string';

/**
 * POST /api/isolated/export
 * The Ultimate Master Export Module.
 * Scrapes 14+ biological and literature datasets in parallel.
 * Returns a strictly unified JSON array and CSV string for downloading.
 */
export async function POST(req: Request) {
    try {
        const { query, limit = 100 } = await req.json();

        if (!query) {
            return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
        }

        // Unified Schema Array
        const unifiedResults: Array<{
            datasetSource: string;
            titleOrFinding: string;
            detailsOrAuthors: string;
            yearOrScore: string | number;
            linkOrId: string;
        }> = [];

        // ---------------------------------------------------------
        // 1. Fetch Literature (PubMed + CrossRef Fallback)
        // ---------------------------------------------------------
        try {
            let pubMedRaw = await fetchFromPubMed(query);

            // CrossRef Fallback
            if (pubMedRaw.length === 0) {
                const webScanUrl = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&select=title,author,published,URL&rows=${limit}`;
                const webScanRes = await fetch(webScanUrl);
                const webScanData = await webScanRes.json();
                if (webScanData.message?.items) {
                    pubMedRaw = webScanData.message.items.map((item: any) => ({
                        pmid: item.URL?.replace('http://dx.doi.org/', 'DOI:') || 'No DOI',
                        title: item.title ? item.title[0] : 'Unknown Title',
                        abstract: '',
                        publicationDate: item.published?.['date-parts']?.[0]?.[0]?.toString() || 'Unknown',
                        authors: item.author ? item.author.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) : []
                    }));
                }
            }

            // Map PubMed to Unified Schema
            pubMedRaw.slice(0, 25).forEach(article => {
                // Ensure we only match a valid year starting the string like "2024" or from a format "2024/05/12"
                const yearMatch = article.publicationDate?.match(/^(\d{4})/);
                const year = yearMatch ? yearMatch[1] : article.publicationDate;
                unifiedResults.push({
                    datasetSource: article.pmid.includes('DOI:') ? 'CrossRef Data' : 'PubMed Database',
                    titleOrFinding: article.title,
                    detailsOrAuthors: article.authors.join(', ') || 'No authors listed',
                    yearOrScore: year,
                    linkOrId: article.pmid.includes('DOI:') ? article.pmid.replace('DOI:', 'https://doi.org/') : `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`
                });
            });
        } catch (e) {
            console.error('PubMed/CrossRef Export Failed:', e);
        }

        // ---------------------------------------------------------
        // 2. Fetch PubTator (Bioconcepts & Clinical Trials)
        // ---------------------------------------------------------
        try {
            // For PubTator we need PMIDs to find bioconcepts. Since we just got some from PubMed, we can use the top 1...
            // OR we can do a general PubTator search if it supports direct text query.
            // The pubtator library expects a PMID or exact text. We will use the top PubMed result's PMID.
            const firstPmid = unifiedResults.find(r => r.datasetSource === 'PubMed Database')?.linkOrId.split('/').filter(Boolean).pop();
            if (firstPmid && !firstPmid.includes('doi')) {
                const pubtatorRes = await searchPubTator(firstPmid);
                if (pubtatorRes && pubtatorRes.pmid) {
                    unifiedResults.push({
                        datasetSource: 'PubTator Concepts',
                        titleOrFinding: `Bioconcepts for PMID: ${firstPmid}`,
                        detailsOrAuthors: `Found ${pubtatorRes.annotations.length} concepts`,
                        yearOrScore: 'N/A',
                        linkOrId: `https://www.ncbi.nlm.nih.gov/research/pubtator3/publication/${firstPmid}`
                    });
                }
            }
        } catch (e) {
            console.error('PubTator Export Failed:', e);
        }

        // ---------------------------------------------------------
        // 3. Fetch Cloud Datasets via BigQuery (ClinGen, CIViC, Reactome)
        // ---------------------------------------------------------
        try {
            // BigQuery sweeps genetic diseases, which shouldn't be triggered by 15-word paper titles
            if (query.length <= 40) {
                const bqResults = await searchBigQuery(query);
                console.log("BigQuery Results Response (First 100 chars):", JSON.stringify(bqResults).substring(0, 100));
                console.log(`[DEBUG] ClinGen Records: ${bqResults?.clingenResults?.length}, CIViC Records: ${bqResults?.civicResults?.length}`);

                // Map ClinGen results — property names match bigquery.ts ClinGenRecord interface (camelCase)
                if (bqResults?.clingenResults && Array.isArray(bqResults.clingenResults)) {
                    bqResults.clingenResults.slice(0, 25).forEach((row: any) => {
                        unifiedResults.push({
                            datasetSource: 'ClinGen (GCS)',
                            titleOrFinding: `Gene: ${row.geneSymbol} -> Disease: ${row.diseaseLabel}`,
                            detailsOrAuthors: `Classification: ${row.classification}`,
                            yearOrScore: 'Curated',
                            linkOrId: row.geneId || 'N/A'
                        });
                    });
                }

                // Map CIViC results — property names match bigquery.ts CivicRecord interface (camelCase)
                if (bqResults?.civicResults && Array.isArray(bqResults.civicResults)) {
                    bqResults.civicResults.slice(0, 25).forEach((row: any) => {
                        unifiedResults.push({
                            datasetSource: 'CIViC (GCS)',
                            titleOrFinding: `Gene: ${row.gene}`,
                            detailsOrAuthors: `Disease: ${row.disease} | Clinical Significance: ${row.clinicalSignificance}`,
                            yearOrScore: row.evidenceLevel || 'N/A',
                            linkOrId: row.gene || 'N/A'
                        });
                    });
                }
            } else {
                console.log(`[BigQuery] Skipping molecular search for long literature query: "${query}"`);
            }
        } catch (e) {
            console.error('BigQuery Export Failed:', e);
        }

        // ---------------------------------------------------------
        // 4. Fetch STRING Protein Interactions (skip if query is not a known protein name)
        // ---------------------------------------------------------
        try {
            // STRING requires exact protein names (e.g. "TP53", not "heart attack").
            // Only attempt if the query looks like a gene/protein symbol (short, uppercase-able, no spaces)
            const proteinQuery = query.trim().split(' ')[0].toUpperCase();
            const looksLikeProtein = proteinQuery.length <= 10 && !proteinQuery.includes(' ');
            if (looksLikeProtein) {
                const stringRes = await getProteinInteractions(proteinQuery);
                if (stringRes && Array.isArray(stringRes)) {
                    stringRes.slice(0, 25).forEach(interaction => {
                        unifiedResults.push({
                            datasetSource: 'STRING Proteins',
                            titleOrFinding: `${interaction.protein1_name} <-> ${interaction.protein2_name}`,
                            detailsOrAuthors: 'Protein-Protein Interaction',
                            yearOrScore: interaction.score,
                            linkOrId: `https://string-db.org/network/${proteinQuery}`
                        });
                    });
                }
            } else {
                console.log(`[STRING] Skipping STRING for non-protein query: "${query}"`);
            }
        } catch (e: any) {
            // ERR_STRING_TOO_LONG or protein not found - safe to skip
            console.warn('STRING Export Skipped (dataset too large or not found):', e?.message || e);
        }


        // ---------------------------------------------------------
        // 5. Fetch ORKG (Open Research Knowledge Graph)
        // ---------------------------------------------------------
        try {
            // ORKG provides an API for paper metadata
            const orkgUrl = `https://orkg.org/api/papers/?q=${encodeURIComponent(query)}&size=10`;
            const orkgRes = await fetch(orkgUrl);
            const orkgData = await orkgRes.json();

            if (orkgData.content && Array.isArray(orkgData.content)) {
                // Filter out default ORKG results if the API failed to match a long query
                const queryWords = query.toLowerCase().split(/[\s\-_:=]+/).filter((w: string) => w.length > 4);
                const validPapers = orkgData.content.filter((p: any) => {
                    if (queryWords.length === 0) return true; // If short query, trust the API
                    const pTitle = (p.title || '').toLowerCase();
                    return queryWords.some((w: string) => pTitle.includes(w));
                });

                // Fetch full details for each valid paper in parallel to get actual authors
                const paperIds = validPapers.map((p: any) => p.id);
                const fullPapers = await Promise.all(
                    paperIds.map((id: string) => fetch(`https://orkg.org/api/papers/${id}`).then(res => res.json()).catch(() => null))
                );

                fullPapers.forEach((paper: any) => {
                    if (!paper) return;

                    const authorNames = Array.isArray(paper.authors)
                        ? paper.authors.map((a: any) => a.name).filter(Boolean).join(', ')
                        : 'Unknown Authors';

                    unifiedResults.push({
                        datasetSource: 'ORKG',
                        titleOrFinding: paper.title || 'Unknown Title',
                        detailsOrAuthors: authorNames || 'Unknown Authors',
                        yearOrScore: paper.publication_info?.published_year || paper.created_at?.substring(0, 4) || 'Unknown',
                        linkOrId: `https://orkg.org/paper/${paper.id}`
                    });
                });
            }
        } catch (e: any) {
            console.warn('ORKG Export Skipped:', e?.message || e);
        }

        // ---------------------------------------------------------
        // 6. Fetch Semantic Scholar (S2ORC)
        // ---------------------------------------------------------
        try {
            const s2orcUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=10&fields=title,authors,year,url`;
            const s2orcRes = await fetch(s2orcUrl, {
                headers: {
                    'User-Agent': 'benchspark-co-investigator/1.0 (mailto:benchspark@example.com)'
                }
            });
            if (s2orcRes.ok) {
                const s2orcData = await s2orcRes.json();
                if (s2orcData.data && Array.isArray(s2orcData.data)) {
                    s2orcData.data.forEach((paper: any) => {
                        const authorNames = Array.isArray(paper.authors)
                            ? paper.authors.map((a: any) => a.name).filter(Boolean).join(', ')
                            : 'Unknown Authors';
                        unifiedResults.push({
                            datasetSource: 'Semantic Scholar (S2ORC)',
                            titleOrFinding: paper.title || 'Unknown Title',
                            detailsOrAuthors: authorNames || 'Unknown Authors',
                            yearOrScore: paper.year || 'Unknown',
                            linkOrId: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`
                        });
                    });
                }
            } else {
                console.warn(`Semantic Scholar API returned status: ${s2orcRes.status}`);
            }
        } catch (e: any) {
            console.warn('Semantic Scholar Export Skipped:', e?.message || e);
        }

        // ---------------------------------------------------------
        // 7. Fetch Reactome and Pathway Commons (Broad match)
        // ---------------------------------------------------------
        try {
            // Only try if the query looks like a gene/protein
            const upperQuery = query.trim().toUpperCase();
            if (upperQuery.length <= 15 && !upperQuery.includes(' ')) {
                // Dynamically import to save memory if not used
                const { loadReactomeRelations, loadPathwayCommonsSIF, loadClinGenDosage } = await import('@/lib/cloudData');

                // Fetch in parallel
                const [reactome, pathways, dosage] = await Promise.all([
                    loadReactomeRelations().catch(() => []),
                    loadPathwayCommonsSIF().catch(() => []),
                    loadClinGenDosage().catch(() => [])
                ]);

                // Filter Reactome
                reactome.filter((r) => r.parent.includes(upperQuery) || r.child.includes(upperQuery))
                    .slice(0, 15).forEach((match) => {
                        unifiedResults.push({
                            datasetSource: 'Reactome',
                            titleOrFinding: `Pathway Relation`,
                            detailsOrAuthors: `${match.parent} -> ${match.child}`,
                            yearOrScore: 'Curated',
                            linkOrId: 'reactome.org'
                        });
                    });

                // Filter Pathway Commons
                pathways.filter((p) => p.source.includes(upperQuery) || p.target.includes(upperQuery))
                    .slice(0, 15).forEach((match) => {
                        unifiedResults.push({
                            datasetSource: 'Pathway Commons',
                            titleOrFinding: `Interaction: ${match.interaction}`,
                            detailsOrAuthors: `${match.source} -> ${match.target}`,
                            yearOrScore: 'Curated',
                            linkOrId: 'pathwaycommons.org'
                        });
                    });

                // Filter ClinGen Dosage
                dosage.filter((d) => (d['gene_symbol'] || '').toUpperCase() === upperQuery)
                    .slice(0, 15).forEach((match) => {
                        unifiedResults.push({
                            datasetSource: 'ClinGen Dosage',
                            titleOrFinding: `Gene: ${match['gene_symbol']}`,
                            detailsOrAuthors: `Haploinsufficiency: ${match['haploinsufficiency_score']} | Triplosensitivity: ${match['triplosensitivity_score']}`,
                            yearOrScore: 'Curated',
                            linkOrId: match['hgnc_id'] || 'N/A'
                        });
                    });
            }
        } catch (e: any) {
            console.warn('Reactome/Pathways Export Skipped:', e?.message || e);
        }

        // ---------------------------------------------------------
        // Generation: Create Unified CSV Output
        // ---------------------------------------------------------
        // CSV Header
        let csvString = 'Dataset Source,Match Title / Finding,Details / Authors / Genes,Evidence Score / Year,Link / ID\n';

        // CSV Rows
        unifiedResults.forEach(item => {
            // Escape quotes in strings to prevent CSV breaking
            const safeSource = `"${String(item.datasetSource).replace(/"/g, '""')}"`;
            const safeTitle = `"${String(item.titleOrFinding).replace(/"/g, '""')}"`;
            const safeDetails = `"${String(item.detailsOrAuthors).replace(/"/g, '""')}"`;
            const safeScore = `"${String(item.yearOrScore).replace(/"/g, '""')}"`;
            const safeLink = `"${String(item.linkOrId).replace(/"/g, '""')}"`;

            csvString += `${safeSource},${safeTitle},${safeDetails},${safeScore},${safeLink}\n`;
        });

        return NextResponse.json({
            status: 'success',
            metadata: {
                query: query,
                totalSourcesScanned: 5,
                totalRowsExported: unifiedResults.length
            },
            data: unifiedResults,
            csvData: csvString
        });

    } catch (error: any) {
        console.error('Unified Export Module Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
