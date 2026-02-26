import { readGCSFile, listGCSFiles, getGCSCacheStats } from './gcs';

/**
 * Cloud data service — provides access to ALL 15 datasets in the hackathon GCS bucket.
 * All data is read directly from gs://benchspark-data-1771447466-datasets/ at runtime.
 * No local files — everything is cached in memory after first access.
 */

// ---------- Dataset metadata ----------

export interface DatasetInfo {
    name: string;
    path: string;
    description: string;
    size: string;
    source: string;
}

export const DATASETS: DatasetInfo[] = [
    { name: 'bioRxiv/medRxiv', path: 'biorxiv-medrxiv/', description: 'Preprint metadata from bioRxiv and medRxiv', size: '4.79 MiB', source: 'https://api.biorxiv.org/details/' },
    { name: 'CIViC', path: 'civic/', description: 'Clinical evidence for variants in cancer', size: '6.58 MiB', source: 'https://civicdb.org/' },
    { name: 'ClinGen', path: 'clingen/', description: 'Gene-disease validity classifications', size: '31.57 MiB', source: 'https://clinicalgenome.org/' },
    { name: 'ClinicalTrials.gov', path: 'clinicaltrials/', description: 'Clinical trial data (XML/JSON)', size: '152.25 MiB', source: 'https://clinicaltrials.gov/' },
    { name: 'DepMap', path: 'depmap/', description: 'Cancer dependency map data', size: '36.37 GiB', source: 'https://depmap.org/' },
    { name: 'GTEx', path: 'gtex/', description: 'Gene expression across human tissues', size: '1.53 GiB', source: 'https://gtexportal.org/' },
    { name: 'Human Protein Atlas', path: 'human-protein-atlas/', description: 'Protein expression and localization data', size: '121.37 MiB', source: 'https://www.proteinatlas.org/' },
    { name: 'ORKG', path: 'orkg/', description: 'Open Research Knowledge Graph', size: '105.08 MiB', source: 'https://orkg.org/' },
    { name: 'Pathway Commons', path: 'pathway-commons/', description: 'Biological pathway and interaction data', size: '243.82 MiB', source: 'https://www.pathwaycommons.org/' },
    { name: 'PubMed Abstracts', path: 'pubmed-abstracts/', description: 'Full PubMed abstract XML files', size: '50.48 GiB', source: 'https://pubmed.ncbi.nlm.nih.gov/' },
    { name: 'PubMedQA', path: 'pubmedqa/', description: 'PubMed question-answering benchmark', size: '2.48 MiB', source: 'https://github.com/pubmedqa/pubmedqa' },
    { name: 'PubTator 3.0', path: 'pubtator/', description: 'Biomedical entity annotations for PubMed', size: '6.63 GiB', source: 'https://www.ncbi.nlm.nih.gov/research/pubtator3/' },
    { name: 'Reactome', path: 'reactome/', description: 'Curated biological pathways', size: '903.09 MiB', source: 'https://reactome.org/' },
    { name: 'STRING', path: 'string/', description: 'Protein-protein interaction networks (human)', size: '145.8 MiB', source: 'https://string-db.org/' },
];

// ---------- Dataset-specific loaders ----------

/**
 * Loads STRING protein interaction data from cloud.
 */
export async function loadSTRINGInteractions(): Promise<Array<{ protein1: string; protein2: string; score: number }>> {
    const content = await readGCSFile('string/9606.protein.links.v12.0.txt.gz');
    const lines = content.split('\n');
    // First line is header: protein1 protein2 combined_score
    return lines.slice(1).filter((l) => l.trim()).slice(0, 1000).map((line) => {
        const [protein1, protein2, score] = line.split(' ');
        return { protein1, protein2, score: parseInt(score) || 0 };
    });
}

/**
 * Loads STRING protein info from cloud.
 */
export async function loadSTRINGProteinInfo(): Promise<Array<{ id: string; name: string; annotation: string }>> {
    const content = await readGCSFile('string/9606.protein.info.v12.0.txt.gz');
    const lines = content.split('\n');
    return lines.slice(1).filter((l) => l.trim()).slice(0, 1000).map((line) => {
        const fields = line.split('\t');
        return { id: fields[0] || '', name: fields[1] || '', annotation: fields[4] || '' };
    });
}

/**
 * Loads PubMedQA data from cloud.
 */
export async function loadPubMedQA(): Promise<Record<string, unknown>> {
    const content = await readGCSFile('pubmedqa/ori_pqal.json');
    return JSON.parse(content);
}

/**
 * Loads Reactome pathway relationships from cloud.
 */
export async function loadReactomeRelations(): Promise<Array<{ parent: string; child: string }>> {
    const content = await readGCSFile('reactome/ReactomePathwaysRelation.txt');
    return content.split('\n').filter((l) => l.trim()).map((line) => {
        const [parent, child] = line.split('\t');
        return { parent: parent?.trim() || '', child: child?.trim() || '' };
    });
}

/**
 * Loads ClinGen dosage sensitivity data from cloud.
 */
export async function loadClinGenDosage(): Promise<Array<Record<string, string>>> {
    const content = await readGCSFile('clingen/dosage-sensitivity-all.csv');
    const lines = content.split('\n');
    // Skip header comment lines
    const dataLines = lines.filter((l) => l.trim() && !l.startsWith('#'));
    const header = dataLines[0].split(',');
    return dataLines.slice(1).filter((l) => l.trim()).slice(0, 500).map((line) => {
        const fields = line.split(',');
        const record: Record<string, string> = {};
        header.forEach((h, i) => { record[h.trim()] = fields[i]?.trim() || ''; });
        return record;
    });
}

/**
 * Loads Pathway Commons SIF interactions from cloud.
 */
export async function loadPathwayCommonsSIF(): Promise<Array<{ source: string; interaction: string; target: string }>> {
    const content = await readGCSFile('pathway-commons/pc-hgnc.sif.gz');
    const lines = content.split('\n');
    return lines.filter((l) => l.trim()).slice(0, 1000).map((line) => {
        const [source, interaction, target] = line.split('\t');
        return { source: source || '', interaction: interaction || '', target: target || '' };
    });
}

/**
 * Lists all files in a dataset folder.
 */
export async function listDatasetFiles(datasetPath: string): Promise<string[]> {
    return listGCSFiles(datasetPath);
}

/**
 * Reads a specific dataset file from cloud.
 */
export async function readDatasetFile(filePath: string): Promise<string> {
    return readGCSFile(filePath);
}

/**
 * Returns cache statistics.
 */
export function getCacheStats() {
    return getGCSCacheStats();
}
