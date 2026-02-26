import { NextRequest, NextResponse } from 'next/server';
import { fetchFromPubMed } from '@/lib/pubmed';

/**
 * GET /api/tools/pubmed
 * MCP Tool for fetching researcher publication metrics from PubMed
 */
export async function GET(req: NextRequest) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 [Route] GET /api/tools/pubmed');
    try {
        const searchParams = req.nextUrl.searchParams;
        const query = searchParams.get('query') || 'IPF';
        console.log(`📄 [Route] Query: "${query}"`);

        const data = await fetchFromPubMed(query);

        console.log(`📄 [Route] ✅ Returning ${Array.isArray(data) ? data.length : 0} articles`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('📄 [Route] ❌ PubMed API Tool Error:', error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json(
            { error: 'Internal Server Error while querying PubMed.', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
