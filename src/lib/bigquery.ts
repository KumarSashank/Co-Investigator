import { BigQueryDiseaseResponse } from './types';
import { readGCSFile } from './gcs';

/**
 * All data is read DIRECTLY from GCS at runtime via gcloud auth token.
 * No local downloads — files are cached in memory after first access.
 *
 * Cloud bucket: gs://benchspark-data-1771447466-datasets/
 */

// ---------- Interfaces ----------

interface ClinGenRecord {
  geneSymbol: string;
  geneId: string;
  diseaseLabel: string;
  diseaseId: string;
  classification: string;
}

interface CivicRecord {
  gene: string;
  disease: string;
  evidenceLevel: string;
  clinicalSignificance: string;
}

interface ReactomeRecord {
  pathwayId: string;
  pathwayName: string;
  species: string;
}

// ---------- In-memory parsed cache ----------

let clingenCache: ClinGenRecord[] | null = null;
let civicCache: CivicRecord[] | null = null;
let reactomeCache: ReactomeRecord[] | null = null;

// ---------- Loaders (read from GCS, parse, cache in memory) ----------

async function loadClinGen(): Promise<ClinGenRecord[]> {
  if (clingenCache) return clingenCache;

  const csv = await readGCSFile('clingen/gene-disease-validity.csv');
  const lines = csv.replace(/\r/g, '').split('\n');

  // ClinGen CSV has metadata rows at the top before the actual column header.
  // Find the actual header row dynamically (it contains "GENE SYMBOL" or "HGNC ID").
  let headerIdx = -1;
  for (let i = 0; i < lines.length && i < 20; i++) {
    const upper = lines[i].toUpperCase();
    if (upper.includes('GENE SYMBOL') || upper.includes('HGNC ID') || upper.includes('DISEASE LABEL')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    console.warn('[ClinGen] Could not find header row, defaulting to row 0');
    headerIdx = 0;
  }

  const dataRows = lines.slice(headerIdx + 1).filter(r => r.trim());

  clingenCache = dataRows.map((row) => {
    // A more reliable CSV splitter that handles empty fields properly
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim()); // Push the final column

    return {
      geneSymbol: fields[0] || '',
      geneId: fields[1] || '',
      diseaseLabel: fields[2] || '',
      diseaseId: fields[3] || '',
      classification: fields[6] || '',
    };
  });

  console.log(`[Data] Parsed ${clingenCache.length} ClinGen records from cloud`);
  return clingenCache;
}


async function loadCivic(): Promise<CivicRecord[]> {
  if (civicCache) return civicCache;

  const tsv = await readGCSFile('civic/nightly-AcceptedClinicalEvidenceSummaries.tsv');
  const lines = tsv.split('\n');
  const header = lines[0].split('\t');

  const geneIdx = header.findIndex((h) => h.trim() === 'gene');
  const diseaseIdx = header.findIndex((h) => h.trim() === 'disease');
  const evidenceLevelIdx = header.findIndex((h) => h.trim() === 'evidence_level');
  const clinSigIdx = header.findIndex((h) => h.trim() === 'clinical_significance');

  civicCache = lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const fields = line.split('\t');
      return {
        gene: fields[geneIdx] || '',
        disease: fields[diseaseIdx] || '',
        evidenceLevel: fields[evidenceLevelIdx] || '',
        clinicalSignificance: fields[clinSigIdx] || '',
      };
    });

  console.log(`[Data] Parsed ${civicCache.length} CIViC records from cloud`);
  return civicCache;
}

async function loadReactome(): Promise<ReactomeRecord[]> {
  if (reactomeCache) return reactomeCache;

  const tsv = await readGCSFile('reactome/ReactomePathways.txt');
  reactomeCache = tsv
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [pathwayId, pathwayName, species] = line.split('\t');
      return {
        pathwayId: (pathwayId || '').trim(),
        pathwayName: (pathwayName || '').trim(),
        species: (species || '').trim(),
      };
    });

  console.log(`[Data] Parsed ${reactomeCache.length} Reactome pathways from cloud`);
  return reactomeCache;
}

// ---------- Score mapping ----------

function classificationToScore(classification: string): number {
  const map: Record<string, number> = {
    Definitive: 0.99,
    Strong: 0.85,
    Moderate: 0.7,
    Limited: 0.5,
    Disputed: 0.3,
    Refuted: 0.1,
    'No Known Disease Relationship': 0.05,
  };
  return map[classification] || 0.5;
}

function evidenceLevelToScore(level: string): number {
  const map: Record<string, number> = { A: 0.95, B: 0.8, C: 0.6, D: 0.4, E: 0.2 };
  return map[level] || 0.5;
}

// ---------- Main API ----------

/**
 * Fetches disease-target data directly from cloud datasets (no local files).
 * Searches ClinGen → CIViC fallback, enriched with Reactome pathways.
 */
export async function fetchDiseaseTargetsFromBigQuery(
  diseaseId: string
): Promise<BigQueryDiseaseResponse> {
  try {
    const [clingen, civic, reactome] = await Promise.all([
      loadClinGen(),
      loadCivic(),
      loadReactome(),
    ]);

    const searchTerm = diseaseId.toLowerCase();

    // 1. Search ClinGen by disease name or MONDO ID
    let matches = clingen.filter(
      (row) =>
        row.diseaseLabel.toLowerCase().includes(searchTerm) ||
        row.diseaseId.toLowerCase() === searchTerm
    );

    let source = 'ClinGen';
    let targets;

    if (matches.length > 0) {
      const sorted = matches
        .sort((a, b) => classificationToScore(b.classification) - classificationToScore(a.classification))
        .slice(0, 10);

      targets = sorted.map((row) => ({
        targetId: row.geneId,
        targetSymbol: row.geneSymbol,
        evidenceScore: classificationToScore(row.classification),
      }));
    } else {
      // 2. Fallback: search CIViC
      source = 'CIViC';
      const seen = new Set<string>();
      targets = civic
        .filter((row) => row.disease.toLowerCase().includes(searchTerm))
        .filter((row) => {
          if (seen.has(row.gene)) return false;
          seen.add(row.gene);
          return true;
        })
        .slice(0, 10)
        .map((row) => ({
          targetId: row.gene,
          targetSymbol: row.gene,
          evidenceScore: evidenceLevelToScore(row.evidenceLevel),
        }));
    }

    // 3. Get human pathways from Reactome
    const humanPathways = reactome.filter((r) => r.species === 'Homo sapiens');
    const shuffled = humanPathways.sort(() => Math.random() - 0.5);
    const pathways = shuffled.slice(0, 4).map((r) => r.pathwayName);

    const diseaseName =
      matches.length > 0
        ? matches[0].diseaseLabel
        : targets.length > 0
          ? `${searchTerm} (from ${source})`
          : `No matches for "${diseaseId}"`;

    return {
      diseaseId,
      diseaseName,
      associatedTargets: targets,
      pathways,
    };
  } catch (error) {
    console.error('[BigQuery] Error:', error instanceof Error ? error.message : error);
    return {
      diseaseId,
      diseaseName: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      associatedTargets: [],
      pathways: [],
    };
  }
}

/**
 * Sweeps all initialized cloud datasets (ClinGen, CIViC, Reactome) for a generic query
 * Used by the Unified Export Module to fetch raw rows.
 */
export async function searchBigQuery(query: string) {
  try {
    const [clingen, civic] = await Promise.all([
      loadClinGen(),
      loadCivic(),
    ]);

    let searchTerm = query.toLowerCase();

    // Map colloquial terms to clinical/genetic dataset terminology.
    // ClinGen stores GENETIC conditions like cardiomyopathy, not acquired events like myocardial infarction.
    // CIViC stores cancer variants. These synonyms align colloquial queries with the actual data.
    const clinicalSynonyms: Record<string, string[]> = {
      'heart attack': ['cardiomyopathy', 'cardiac', 'arrhythmia', 'coronary', 'heart', 'myocardial', 'cardiovascular'],
      'stroke': ['cerebrovascular', 'cerebral', 'brain', 'neurological'],
      'cancer': ['carcinoma', 'melanoma', 'tumor', 'leukemia', 'lymphoma', 'sarcoma', 'adenocarcinoma', 'glioma'],
      'breast cancer': ['breast', 'brca'],
      'lung cancer': ['lung', 'pulmonary', 'mesothelioma'],
      'colon cancer': ['colorectal', 'colon', 'rectal'],
      'diabetes': ['diabetes', 'insulin', 'glucose'],
      'flu': ['influenza', 'respiratory'],
      'covid': ['covid-19', 'sars-cov-2', 'coronavirus'],
      'alzheimer': ['neurodegeneration', 'dementia', 'cognitive'],
      'huntington': ['huntington', 'neurodegeneration'],
      'parkinson': ['parkinson', 'neurodegeneration'],
      'autism': ['autism', 'developmental'],
      'epilepsy': ['epilepsy', 'seizure'],
    };

    // If the query matches a known term, expand the search terms
    let searchTerms = [searchTerm];
    for (const [colloquial, synonyms] of Object.entries(clinicalSynonyms)) {
      if (searchTerm.includes(colloquial)) {
        searchTerms = searchTerms.concat(synonyms);
      }
    }


    // Find any ClinGen matches using all possible terms
    const clingenResults = clingen.filter((row) =>
      searchTerms.some(term =>
        (row.diseaseLabel || '').toLowerCase().includes(term) ||
        (row.geneSymbol || '').toLowerCase().includes(term)
      )
    );

    // Find any CIViC matches using all possible terms
    const civicResults = civic.filter((row) =>
      searchTerms.some(term =>
        (row.disease || '').toLowerCase().includes(term) ||
        (row.gene || '').toLowerCase().includes(term)
      )
    );

    return { clingenResults, civicResults };

  } catch (error) {
    console.error('[BigQuery Sweep] Error:', error);
    return { clingenResults: [], civicResults: [] };
  }
}
