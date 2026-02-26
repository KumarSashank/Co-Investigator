import { Firestore } from '@google-cloud/firestore';
import { ResearchSession, SubTask } from '../../types';

// Note: Ensure process.env.GOOGLE_CLOUD_PROJECT is set or ADC is configured
const firestore = new Firestore({
    ignoreUndefinedProperties: true
});

const SESSIONS_COLLECTION = 'research_sessions';

/**
 * Creates a new research session with the Vertex AI generated plan.
 */
export async function createSession(originalQuery: string, plan: SubTask[]): Promise<string> {
    const sessionRef = firestore.collection(SESSIONS_COLLECTION).doc();

    // Default initial session state
    const session: ResearchSession = {
        id: sessionRef.id,
        originalQuery,
        status: 'running',
        plan: plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await sessionRef.set(session);
    return session.id;
}

/**
 * Updates an entire session state, usually during a HITL block or step completion.
 */
export async function updateSession(sessionId: string, updates: Partial<ResearchSession>) {
    const sessionRef = firestore.collection(SESSIONS_COLLECTION).doc(sessionId);
    await sessionRef.update({
        ...updates,
        updatedAt: new Date().toISOString()
    });
}

/**
 * Updates a specific subtask within a session.
 */
export async function updateSubTask(sessionId: string, taskId: string, taskUpdates: Partial<SubTask>) {
    const sessionRef = firestore.collection(SESSIONS_COLLECTION).doc(sessionId);

    await firestore.runTransaction(async (t) => {
        const doc = await t.get(sessionRef);
        if (!doc.exists) throw new Error("Session does not exist!");

        const data = doc.data() as ResearchSession;
        const currentPlan = data.plan;

        const updatedPlan = currentPlan.map(task => {
            if (task.id === taskId) {
                return { ...task, ...taskUpdates };
            }
            return task;
        });

        // Determine if we need to pause for HITL
        // Example logic: if any task completes, pause before the next one if it requires User Confirmation
        let newStatus = data.status;
        const allCompleted = updatedPlan.every(t => t.status === 'completed' || t.status === 'failed');

        if (allCompleted) {
            newStatus = 'completed';
        } else if (taskUpdates.status === 'completed') {
            // Very basic HITL simulation: if one task completes, pause the session and ask user
            newStatus = 'hitl_paused';
        }

        t.update(sessionRef, {
            plan: updatedPlan,
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
    });
}

/**
 * Retrieves the current session. Polled by the frontend to render the UI.
 */
export async function getSession(sessionId: string): Promise<ResearchSession | null> {
    const sessionRef = firestore.collection(SESSIONS_COLLECTION).doc(sessionId);
    const doc = await sessionRef.get();

    if (!doc.exists) return null;
    return doc.data() as ResearchSession;
}
