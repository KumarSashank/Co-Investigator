import { NextResponse } from 'next/server';
import { firestore_get_session } from '@/lib/firestore/stateEngine';
import { logger } from '@/lib/logger';

/**
 * GET /api/agent/session?sessionId=xxx
 * Loads a full session by ID for restoring a previous research project.
 */

const LOG = '📂 [Session]';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        logger.info(`${LOG} Loading session: ${sessionId}`);

        const session = await firestore_get_session(sessionId);

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        logger.info(`${LOG} ✅ Loaded session: "${session.user_request?.slice(0, 50)}..."`);

        return NextResponse.json({ session });
    } catch (error: any) {
        logger.error(`${LOG} ❌ Failed to load session: ${error.message}`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
