# Shared Context & DTOs (Data Transfer Objects)

**INSTRUCTION FOR ALL TEAM MEMBERS:** 
Whenever you start a new chat with your AI (Cursor, Antigravity, ChatGPT), you MUST copy-paste this entire document into the context window first. This ensures all AIs generate code that is perfectly compatible with the rest of the team.

## Global Types (TypeScript)

These are the exact data structures we are passing between the Frontend, the API Routes, and the Agent. Do not deviate from these types.

### 1. Task & State Management (Firestore & Frontend)

```typescript
// Represents the entire research session
export interface ResearchSession {
  id: string; // Firestore Document ID
  originalQuery: string;
  status: 'planning' | 'running' | 'hitl_paused' | 'completed' | 'error';
  plan: SubTask[];
  finalReportMarkdown?: string;
  createdAt: string; // ISO Date String
  updatedAt: string; // ISO Date String
}

// Represents a single step in the Agent's plan
export interface SubTask {
  id: string; // e.g., "step-1"
  description: string; // e.g., "Query BigQuery for IPF targets"
  toolToUse: 'bigquery' | 'openalex' | 'pubmed' | 'none';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  resultData?: any; // The raw JSON returned by the tool
}

// The exact payload sent to the Agent to approve continuing past a HITL checkpoint
export interface HitlApprovalPayload {
  sessionId: string;
  approved: boolean;
  userFeedback?: string; // e.g., "Only focus on the top 3 authors"
}
```

### 2. Tool Outputs (API Responses)

When the Backend Lead builds an API route, the AI must ensure it returns exactly this structure. When the Frontend Lead builds the UI, the AI must expect exactly this structure.

```typescript
// Returned by GET /api/tools/bigquery
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

// Returned by GET /api/tools/openalex
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

// Returned by GET /api/tools/pubmed
export interface PubMedArticleResponse {
  pmid: string;
  title: string;
  abstract: string;
  publicationDate: string;
  authors: string[];
}
```

## How to use this document
- **Frontend Lead:** Tell Cursor: "Use the `ResearchSession` and `SubTask` interfaces from `shared_context.md` to build the Task Checklist UI."
- **Backend Lead:** Tell Cursor: "Build an API route at `/api/tools/openalex` that fetches data and returns the `OpenAlexAuthorResponse` interface defined in `shared_context.md`."
- **Agent Lead:** Tell Antigravity: "The Vertex AI planner must output a JSON array of `SubTask` objects exactly matching the interface in `shared_context.md`."
