// ============================================================
// Co-Investigator — Shared TypeScript Interfaces
// Implementing strict DeepResearch Plan DSL structure
// ============================================================

export type AgentToolName =
  | 'vertex_search_retrieve'
  | 'openalex_search_authors'
  | 'openalex_get_author'
  | 'pubmed_search'
  | 'pubmed_fetch'
  | 'bigquery'
  | 'hitl_pause'
  | 'firestore_get_session'
  | 'firestore_upsert_session'
  | 'gcs_write'
  | 'none';

export type StepIntent =
  | 'retrieve'
  | 'identify'
  | 'rank'
  | 'verify'
  | 'extract'
  | 'synthesize'
  | 'hypothesize'
  | 'design_study'
  | 'compare'
  | 'analyze'
  | 'other';

export type StepStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'BLOCKED' | 'FAILED';

export interface PlanStep {
  id: string;
  name: string;
  intent: StepIntent | string;
  tools: AgentToolName[];
  inputs: Record<string, any>;
  expected_output: string[];
  status: StepStatus;
  notes: string;

  // Custom fields not strict to DSL but useful for tracking execution
  result_data?: any;
  error?: string;
}

export interface DeepResearchPlan {
  session_id: string;
  user_request: string;
  plan: PlanStep[];
  awaiting_confirmation: boolean;
  checkpoint_question: string | null;
  checkpoint_options?: string[]; // Added to track specific multiple choice options (A, B, C...)
  artifacts: Record<string, string>; // Maps description to gs:// URI
  final_output: string | null;

  // Backend tracking
  createdAt: string;
  updatedAt: string;
}

export interface HitlApprovalPayload {
  session_id: string;
  approved: boolean; // Keep for legacy / simple hitl
  choice?: string; // The specific option (A, B, C, D) the user chose
  userFeedback?: string;
}

// ---- Synthesis Board / Curation Types ----
export type PinnedItemType = 'target' | 'researcher' | 'paper' | 'note';

export interface PinnedItem {
  id: string;
  type: PinnedItemType;
  title: string;
  subtitle?: string;
  metrics?: Record<string, string | number>;
  sourceStepId?: string; // Which execution step found this
  content?: string; // AI summary or explicit content
  raw_data?: any; // The original JSON object for deep drill
  pinnedAt: string;
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

export type ActivityLevel = 'ACTIVE' | 'MODERATE' | 'LOW';

export interface OpenAlexAuthorResponse {
  authorId: string;
  displayName: string;
  profileUrl: string;
  currentInstitution: string;
  metrics: {
    worksCount: number;
    citedByCount: number;
    hIndex: number;
  };
  score: number;
  activityLevel: ActivityLevel;
  lastRelevantWorkYear: number;
  recentPublications: Array<{
    title: string;
    year: number;
    citationCount: number;
    doi: string | null;
    url: string;
  }>;
}

export interface PubMedArticleResponse {
  pmid: string;
  title: string;
  abstract: string;
  publicationDate: string;
  authors: string[];
  affiliations: string[];
  correspondingEmail: string | null;
}
