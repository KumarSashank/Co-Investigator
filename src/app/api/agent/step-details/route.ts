import { NextResponse } from 'next/server';
import { getStepRawData } from '@/lib/firestore/stateEngine';

/**
 * GET /api/agent/step-details?sessionId=X&stepId=S1
 * 
 * On-demand endpoint that fetches the FULL raw tool output for a specific step.
 * Called only when the user clicks "View Details" in the UI.
 * This keeps the main session lean — raw data lives in a Firestore subcollection.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const stepId = searchParams.get('stepId');

    if (!sessionId || !stepId) {
        return NextResponse.json(
            { error: 'sessionId and stepId are required' },
            { status: 400 }
        );
    }

    const rawData = await getStepRawData(sessionId, stepId);

    if (!rawData) {
        return NextResponse.json(
            { error: `No raw data found for step ${stepId}` },
            { status: 404 }
        );
    }

    return NextResponse.json({
        status: 'success',
        sessionId,
        stepId,
        rawData
    });
}
