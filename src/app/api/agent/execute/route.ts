import { NextResponse } from 'next/server';
import { getSession, updateSubTask } from '../../../../lib/firestore/stateEngine';
import { SubTask } from '../../../../types';

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

        const task = session.plan.find(t => t.id === taskId);
        if (!task) {
            return NextResponse.json({ error: 'Task not found in session plan' }, { status: 404 });
        }

        // 2. Mark task as in progress
        await updateSubTask(sessionId, taskId, { status: 'in_progress' });

        // 3. Execute the appropriate tool (simulating internal fetch to our own Next.js API Routes)
        // NOTE: In a real environment, you'd use absolute URLs or server-side function calls.
        // For this hackathon structure, we just simulate the routing logic here.
        let simulatedToolResult = null;

        // Create absolute URL base for relative fetching within Next.js API
        // Using a dummy localhost URL for server-side relative fetching workaround.
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

        if (task.toolToUse === 'bigquery') {
            // Querying the route that the Backend Lead is building
            const res = await fetch(`${baseUrl}/api/tools/bigquery?disease=${encodeURIComponent(session.originalQuery)}`);
            simulatedToolResult = await res.json();
        }
        else if (task.toolToUse === 'openalex') {
            const res = await fetch(`${baseUrl}/api/tools/openalex?keyword=${encodeURIComponent(session.originalQuery)}`);
            simulatedToolResult = await res.json();
        }
        // ... logic for pubmed

        // 4. Update the task with the result and mark it complete
        // The stateEngine will automatically determine if a Human-in-the-Loop pause is required via updateSubTask.
        await updateSubTask(sessionId, taskId, {
            status: 'completed',
            resultData: simulatedToolResult
        });

        return NextResponse.json({
            status: 'success',
            taskId,
            result: simulatedToolResult
        });

    } catch (error: any) {
        console.error('Agent Execution Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
