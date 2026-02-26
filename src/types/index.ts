// These types mirror the DTOs defined in /context/shared_context.md
// Everyone's AI tools should be trying to adhere to these structures.

export interface ResearchSession {
    id: string; // Firestore Document ID
    originalQuery: string;
    status: 'planning' | 'running' | 'hitl_paused' | 'completed' | 'error';
    plan: SubTask[];
    finalReportMarkdown?: string;
    createdAt: string; // ISO Date String
    updatedAt: string; // ISO Date String
}

export interface SubTask {
    id: string; // e.g., "step-1"
    description: string; // e.g., "Query BigQuery for IPF targets"
    toolToUse: 'bigquery' | 'openalex' | 'pubmed' | 'none';
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    resultData?: any; // The raw JSON returned by the tool
}

export interface HitlApprovalPayload {
    sessionId: string;
    approved: boolean;
    userFeedback?: string;
}

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
