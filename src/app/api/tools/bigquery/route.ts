import { NextResponse } from 'next/server';

/**
 * GET /api/tools/bigquery
 * MCP Tool for fetching disease/target data from Hackathon Datasets
 * Note to Backend Lead (Cursor):
 * 1. Implement @google-cloud/bigquery logic here.
 * 2. Return data exactly matching 'BigQueryDiseaseResponse' from shared_context.md
 */
export async function GET(req: Request) {
    // Extract query params
    const { searchParams } = new URL(req.url);
    const targetPrefix = searchParams.get('disease') || 'IPF';

    // TODO: Replace this mock data with actual BigQuery SDK calls 
    // against the Open Targets or GPQA datasets provided by BenchSpark.
    const mockResponse = {
        diseaseId: `MOCK-${targetPrefix}-001`,
        diseaseName: targetPrefix,
        associatedTargets: [
            { targetId: 'ENSG00000100001', targetSymbol: 'MOCK_GENE_A', evidenceScore: 0.95 },
            { targetId: 'ENSG00000100002', targetSymbol: 'MOCK_GENE_B', evidenceScore: 0.82 }
        ],
        pathways: ['Mock Pathway Beta', 'Mock Pathway Alpha']
    };

    return NextResponse.json(mockResponse);
}
