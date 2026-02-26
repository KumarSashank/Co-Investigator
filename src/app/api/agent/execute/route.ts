import { NextResponse } from 'next/server';
import { getSession, updateSubTask } from '@/lib/firestore/stateEngine';
import { SubTask } from '@/lib/types';

/**
 * POST /api/agent/execute
 * Executes a single sub-task from the plan by calling the corresponding Tool API route.
 * This represents the "Act" and "Observe" parts of the ReAct loop.
 */
export async function POST(req: Request) {
    try {
        const { sessionId, taskId, toolParams } = await req.json();

        if (!sessionId || !taskId) {
            return NextResponse.json({ error: 'sessionId and taskId are required' }, { status: 400 });
        }

        // 1. Fetch current session state
        const session = await getSession(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const task = session.plan.find((t: SubTask) => t.id === taskId);
        if (!task) {
            return NextResponse.json({ error: 'Task not found in session plan' }, { status: 404 });
        }

        // 2. Mark task as in progress
        await updateSubTask(sessionId, taskId, { status: 'in_progress' });

        // 3. Execute the appropriate tool
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        let toolResult = null;

        if (task.toolToUse === 'bigquery') {
            const res = await fetch(`${baseUrl}/api/tools/bigquery?disease=${encodeURIComponent(session.originalQuery)}`);
            toolResult = await res.json();
        }
        else if (task.toolToUse === 'openalex') {
            const res = await fetch(`${baseUrl}/api/tools/openalex?keyword=${encodeURIComponent(session.originalQuery)}`);
            toolResult = await res.json();
        }
        else if (task.toolToUse === 'pubmed') {
            const res = await fetch(`${baseUrl}/api/tools/pubmed?query=${encodeURIComponent(session.originalQuery)}`);
            toolResult = await res.json();
        }

        // 4. Update the task with the result and mark it complete
        await updateSubTask(sessionId, taskId, {
            status: 'completed',
            resultData: toolResult
        });

        return NextResponse.json({
            status: 'success',
            taskId,
            result: toolResult
        });

    } catch (error: any) {
        console.error('Agent Execution Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
