import { ResearchSession, SubTask } from '@/types';

/**
 * In-Memory State Engine
 * 
 * Uses a simple Map to store sessions in server memory.
 * This works perfectly for local development and hackathon demos.
 * For production, swap this with Firestore by enabling the API and 
 * uncommenting the Firestore implementation below.
 */

const sessions = new Map<string, ResearchSession>();

/**
 * Creates a new research session with the Vertex AI generated plan.
 */
export async function createSession(originalQuery: string, plan: SubTask[]): Promise<string> {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const session: ResearchSession = {
        id,
        originalQuery,
        status: 'running',
        plan: plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    sessions.set(id, session);
    console.log(`[StateEngine] Created session: ${id}`);
    return id;
}

/**
 * Updates an entire session state, usually during a HITL block or step completion.
 */
export async function updateSession(sessionId: string, updates: Partial<ResearchSession>) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} does not exist`);

    const updated = {
        ...session,
        ...updates,
        updatedAt: new Date().toISOString()
    };
    sessions.set(sessionId, updated);
    console.log(`[StateEngine] Updated session: ${sessionId}, status: ${updated.status}`);
}

/**
 * Updates a specific subtask within a session.
 */
export async function updateSubTask(sessionId: string, taskId: string, taskUpdates: Partial<SubTask>) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} does not exist`);

    const updatedPlan = session.plan.map((task: SubTask) => {
        if (task.id === taskId) {
            return { ...task, ...taskUpdates };
        }
        return task;
    });

    // Determine if we need to pause for HITL
    let newStatus = session.status;
    const allCompleted = updatedPlan.every((t: SubTask) => t.status === 'completed' || t.status === 'failed');

    if (allCompleted) {
        newStatus = 'completed';
    } else if (taskUpdates.status === 'completed') {
        // HITL: pause after each task completes so user can review
        newStatus = 'hitl_paused';
    }

    const updated: ResearchSession = {
        ...session,
        plan: updatedPlan,
        status: newStatus,
        updatedAt: new Date().toISOString()
    };
    sessions.set(sessionId, updated);
    console.log(`[StateEngine] Updated task ${taskId} in session ${sessionId}, session status: ${newStatus}`);
}

/**
 * Retrieves the current session.
 */
export async function getSession(sessionId: string): Promise<ResearchSession | null> {
    return sessions.get(sessionId) || null;
}
