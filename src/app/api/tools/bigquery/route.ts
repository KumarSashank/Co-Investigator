import { NextRequest, NextResponse } from 'next/server';
import { fetchDiseaseTargetsFromBigQuery } from '@/lib/bigquery';

/**
 * GET /api/tools/bigquery
 * MCP Tool for fetching disease/target data from Hackathon Datasets
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const diseaseId = searchParams.get('disease') || searchParams.get('diseaseId') || 'IPF';

        const data = await fetchDiseaseTargetsFromBigQuery(diseaseId);

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('BigQuery API Tool Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error while querying BigQuery.', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
