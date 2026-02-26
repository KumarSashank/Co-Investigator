import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthorFromOpenAlex } from '@/lib/openalex';

/**
 * GET /api/tools/openalex
 * MCP Tool for fetching researcher publication metrics from OpenAlex
 */
export async function GET(req: NextRequest) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔬 [Route] GET /api/tools/openalex');
    try {
        const searchParams = req.nextUrl.searchParams;
        const authorName = searchParams.get('author') || searchParams.get('authorName') || searchParams.get('keyword') || 'Dr. Mock';
        console.log(`🔬 [Route] Param resolved: author="${authorName}" (raw params: ${searchParams.toString()})`);

        const data = await fetchAuthorFromOpenAlex(authorName);

        console.log(`🔬 [Route] ✅ Returning data for: ${data.displayName}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('🔬 [Route] ❌ OpenAlex API Tool Error:', error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        return NextResponse.json(
            { error: 'Internal Server Error while querying OpenAlex.', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
