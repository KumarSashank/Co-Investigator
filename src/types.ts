// ============================================================
// Co-Investigator — Shared TypeScript Interfaces & Mock Data
// Source: context/shared_context.md
// ============================================================

// ---- Task & State Management (Firestore & Frontend) ----

export interface ResearchSession {
  id: string;
  originalQuery: string;
  status: 'planning' | 'running' | 'hitl_paused' | 'completed' | 'error';
  plan: SubTask[];
  finalReportMarkdown?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubTask {
  id: string;
  description: string;
  toolToUse: 'bigquery' | 'openalex' | 'pubmed' | 'none';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  resultData?: any;
}

export interface HitlApprovalPayload {
  sessionId: string;
  approved: boolean;
  userFeedback?: string;
}

// ---- Tool Outputs (API Responses) ----

export interface BigQueryDiseaseResponse {
  diseaseId: string;
  diseaseName: string;
  associatedTargets: Array<{
    targetId: string;
    targetSymbol: string;
    evidenceScore: number;
  }>;
  pathways: string[];
}

export interface OpenAlexAuthorResponse {
  authorId: string;
  displayName: string;
  currentInstitution: string;
  metrics: {
    worksCount: number;
    citedByCount: number;
    hIndex: number;
  };
  recentPublications: Array<{
    title: string;
    year: number;
    citationCount: number;
  }>;
}

export interface PubMedArticleResponse {
  pmid: string;
  title: string;
  abstract: string;
  publicationDate: string;
  authors: string[];
}

// ---- Mock Data ----

export const MOCK_PLAN: SubTask[] = [
  {
    id: 'step-1',
    description: 'Query BigQuery for IPF target-disease associations and evidence scores',
    toolToUse: 'bigquery',
    status: 'completed',
    resultData: {
      diseaseId: 'EFO_0000768',
      diseaseName: 'Idiopathic Pulmonary Fibrosis',
      associatedTargets: [
        { targetId: 'ENSG00000163735', targetSymbol: 'MUC5B', evidenceScore: 0.92 },
        { targetId: 'ENSG00000120217', targetSymbol: 'TERT', evidenceScore: 0.87 },
        { targetId: 'ENSG00000164362', targetSymbol: 'TGFB1', evidenceScore: 0.81 },
      ],
      pathways: ['TGF-beta signaling', 'Telomere maintenance', 'Wnt signaling pathway'],
    },
  },
  {
    id: 'step-2',
    description: 'Fetch recent IPF publications from PubMed (last 3 years)',
    toolToUse: 'pubmed',
    status: 'in_progress',
  },
  {
    id: 'step-3',
    description: 'Identify active IPF researchers via OpenAlex citation metrics',
    toolToUse: 'openalex',
    status: 'pending',
  },
  {
    id: 'step-4',
    description: 'Cross-reference targets with clinical trial data',
    toolToUse: 'bigquery',
    status: 'pending',
  },
  {
    id: 'step-5',
    description: 'Synthesize findings into a final research brief',
    toolToUse: 'none',
    status: 'pending',
  },
];

export const MOCK_SESSION: ResearchSession = {
  id: 'session-abc-123',
  originalQuery: 'Investigate the genetic basis of Idiopathic Pulmonary Fibrosis (IPF) progression and identify key researchers in the field',
  status: 'hitl_paused',
  plan: MOCK_PLAN,
  finalReportMarkdown: `## Research Brief: Idiopathic Pulmonary Fibrosis (IPF)

### Executive Summary
Idiopathic Pulmonary Fibrosis (IPF) is a chronic, progressive lung disease characterized by scarring of the lung tissue. Our analysis identified **3 high-confidence genetic targets** and **12 active researchers** in the field.

### Key Genetic Targets

| Target | Symbol | Evidence Score | Pathway |
|--------|--------|---------------|---------|
| MUC5B | rs35705950 | 0.92 | Mucin production |
| TERT | rs2736100 | 0.87 | Telomere maintenance |
| TGFB1 | rs1800470 | 0.81 | TGF-β signaling |

### Top Researchers
1. **Dr. Imre Noth** — University of Virginia, h-index: 52
2. **Dr. Talmadge E. King Jr.** — UCSF, h-index: 78
3. **Dr. Ganesh Raghu** — University of Washington, h-index: 91

### Recent Publications (2023-2025)
- *"Genome-wide association study identifies new susceptibility locus for IPF"* — Nature Genetics, 2024
- *"MUC5B promoter variant and telomere length in IPF progression"* — AJRCCM, 2023
- *"Single-cell RNA sequencing reveals novel fibroblast subtypes in IPF lungs"* — Science, 2025

### Conclusions
The convergence of **telomere biology** and **TGF-β signaling** pathways presents the most promising therapeutic targets. Further investigation into the MUC5B promoter variant is recommended.

---
*Sources verified via Google Search grounding. Confidence: High.*`,
  createdAt: '2026-02-26T12:00:00Z',
  updatedAt: '2026-02-26T12:25:00Z',
};
