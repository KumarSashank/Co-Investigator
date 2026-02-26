import { NextResponse } from 'next/server';
import { getSession, updateSubTask } from '../../../../lib/firestore/stateEngine';
import { SubTask } from '../../../../types';

const LOG = '🤖 [Execute]';

/**
 * POST /api/agent/execute
 * Executes a single sub-task from the plan by calling the corresponding Tool API route.
 * This represents the "Act" and "Observe" parts of the ReAct loop.
 */
export async function POST(req: Request) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`${LOG} POST /api/agent/execute`);
    try {
        const { sessionId, taskId, toolParams } = await req.json();
        console.log(`${LOG} Input: sessionId="${sessionId}", taskId="${taskId}"`);

        if (!sessionId || !taskId) {
            console.error(`${LOG} ❌ Missing required params`);
            return NextResponse.json({ error: 'sessionId and taskId are required' }, { status: 400 });
        }

        // 1. Fetch current session state
        console.log(`${LOG} Fetching session...`);
        const session = await getSession(sessionId);
        if (!session) {
            console.error(`${LOG} ❌ Session not found: ${sessionId}`);
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }
        console.log(`${LOG} ✅ Session found: query="${session.originalQuery}", ${session.plan.length} tasks`);

        const task = session.plan.find((t: SubTask) => t.id === taskId);
        if (!task) {
            console.error(`${LOG} ❌ Task ${taskId} not found in plan`);
            return NextResponse.json({ error: 'Task not found in session plan' }, { status: 404 });
        }
        console.log(`${LOG} Task: "${task.description}" → tool: ${task.toolToUse}`);

        // 2. Mark task as in progress
        await updateSubTask(sessionId, taskId, { status: 'in_progress' });
        console.log(`${LOG} Status → in_progress`);

        // 3. Execute the appropriate tool
        let simulatedToolResult = null;
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

        if (task.toolToUse === 'bigquery') {
            console.log(`${LOG} 🗄️ Calling BigQuery tool...`);
            const url = `${baseUrl}/api/tools/bigquery?disease=${encodeURIComponent(session.originalQuery)}`;
            console.log(`${LOG}    URL: ${url}`);
            const res = await fetch(url);
            console.log(`${LOG}    Response: ${res.status} ${res.statusText}`);
            simulatedToolResult = await res.json();
        }
        else if (task.toolToUse === 'openalex') {
            console.log(`${LOG} 🔬 Calling OpenAlex tool...`);
            const url = `${baseUrl}/api/tools/openalex?keyword=${encodeURIComponent(session.originalQuery)}`;
            console.log(`${LOG}    URL: ${url}`);
            const res = await fetch(url);
            console.log(`${LOG}    Response: ${res.status} ${res.statusText}`);
            simulatedToolResult = await res.json();
        }
        else if (task.toolToUse === 'pubmed') {
            console.log(`${LOG} 📄 Calling PubMed tool...`);
            const url = `${baseUrl}/api/tools/pubmed?query=${encodeURIComponent(session.originalQuery)}`;
            console.log(`${LOG}    URL: ${url}`);
            const res = await fetch(url);
            console.log(`${LOG}    Response: ${res.status} ${res.statusText}`);
            simulatedToolResult = await res.json();
        }
        else if (task.toolToUse === 'none') {
            console.log(`${LOG} 🤖 Synthesis step — no tool call needed`);
            simulatedToolResult = { message: 'Synthesis step completed', query: session.originalQuery };
        }

        console.log(`${LOG} Tool result preview: ${JSON.stringify(simulatedToolResult).substring(0, 200)}...`);

        // 4. Update the task with the result and mark it complete
        await updateSubTask(sessionId, taskId, {
            status: 'completed',
            resultData: simulatedToolResult
        });
        console.log(`${LOG} ✅ Task ${taskId} completed`);
        console.log(`${'═'.repeat(60)}\n`);

        return NextResponse.json({
            status: 'success',
            taskId,
            result: simulatedToolResult
        });

    } catch (error: any) {
        console.error(`${LOG} ❌ FATAL ERROR:`, error.message);
        console.error(`${LOG}    Stack:`, error.stack);
        console.log(`${'═'.repeat(60)}\n`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
