import { NextRequest, NextResponse } from 'next/server';
import { fetchAuthorFromOpenAlex } from '@/lib/openalex';

/**
 * GET /api/tools/openalex
 * MCP Tool for fetching researcher publication metrics from OpenAlex
 */
export async function GET(req: NextRequest) {
    try {
        const searchParams = req.nextUrl.searchParams;
        const authorName = searchParams.get('author') || searchParams.get('authorName') || searchParams.get('keyword') || 'Dr. Mock';

        const data = await fetchAuthorFromOpenAlex(authorName);

        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('OpenAlex API Tool Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error while querying OpenAlex.', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
