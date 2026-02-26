import { NextResponse } from 'next/server';

/**
 * GET /api/tools/openalex
 * MCP Tool for fetching researcher publication metrics from OpenAlex
 * Note to Backend Lead (Cursor):
 * 1. Implement external API calls here.
 * 2. Return data exactly matching 'OpenAlexAuthorResponse' from shared_context.md
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get('keyword') || 'disease';

    const mockResponse = {
        authorId: `A-MOCK-AUTHOR-X99-${keyword}`,
        displayName: `Dr. Mock Researcher (${keyword})`,
        currentInstitution: 'Mock University of Bioinformatics',
        metrics: {
            worksCount: 142,
            citedByCount: 4500,
            hIndex: 35
        },
        recentPublications: [
            { title: `Analysis of ${keyword} Progression`, year: 2024, citationCount: 12 },
            { title: `Novel therapeutic targets in ${keyword}`, year: 2023, citationCount: 45 }
        ]
    };

    return NextResponse.json(mockResponse);
}
