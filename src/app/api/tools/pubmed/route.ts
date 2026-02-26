import { NextRequest, NextResponse } from 'next/server';
import { fetchFromPubMed } from '@/lib/pubmed';

/**
 * GET /api/tools/pubmed
 * MCP Tool for fetching researcher publication metrics from PubMed
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const query = searchParams.get('query') || 'IPF';

        const data = await fetchFromPubMed(query);

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('PubMed API Tool Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error while querying PubMed.', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
