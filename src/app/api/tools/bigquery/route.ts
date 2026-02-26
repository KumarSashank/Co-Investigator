import { NextRequest, NextResponse } from 'next/server';
import { fetchDiseaseTargetsFromBigQuery } from '@/lib/bigquery';

/**
 * GET /api/tools/bigquery
 * MCP Tool for fetching disease/target data from Hackathon Datasets
 */
export async function GET(req: NextRequest) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🗄️ [Route] GET /api/tools/bigquery');
    try {
        const searchParams = req.nextUrl.searchParams;
        const diseaseId = searchParams.get('disease') || searchParams.get('diseaseId') || 'IPF';
        console.log(`🗄️ [Route] Disease: "${diseaseId}"`);

        const data = await fetchDiseaseTargetsFromBigQuery(diseaseId);

        console.log(`🗄️ [Route] ✅ Returning ${data.associatedTargets?.length || 0} targets`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('🗄️ [Route] ❌ BigQuery API Tool Error:', error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json(
            { error: 'Internal Server Error while querying BigQuery.', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
