import { NextResponse } from 'next/server';
import { Firestore } from '@google-cloud/firestore';
import { logger } from '@/lib/logger';

/**
 * GET /api/agent/sessions
 * Returns a list of recent research sessions, ordered by creation date.
 * Used to populate the session history sidebar.
 * 
 * Query params:
 *   ?limit=20 (default: 20, max: 50)
 */

const firestore = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986',
});

const COLLECTION_NAME = 'co_investigator_sessions';
const LOG = '📂 [Sessions]';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

        logger.info(`${LOG} Fetching recent sessions (limit: ${limit})`);

        const snapshot = await firestore
            .collection(COLLECTION_NAME)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .select('session_id', 'user_request', 'createdAt', 'updatedAt', 'final_output')
            .get();

        const sessions = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                session_id: data.session_id || doc.id,
                user_request: data.user_request || 'Untitled Research',
                createdAt: data.createdAt || null,
                updatedAt: data.updatedAt || null,
                hasReport: !!data.final_output,
                // Truncate the query for sidebar preview
                preview: (data.user_request || '').slice(0, 80),
            };
        });

        logger.info(`${LOG} ✅ Returning ${sessions.length} sessions`);

        return NextResponse.json({ sessions });
    } catch (error: any) {
        logger.error(`${LOG} ❌ Failed to list sessions: ${error.message}`);
        return NextResponse.json({ error: error.message, sessions: [] }, { status: 500 });
    }
}
