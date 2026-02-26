import { DeepResearchPlan, PlanStep } from '@/types';

/**
 * In-Memory State Engine (Mocking Firestore)
 * 
 * Uses globalThis to persist the Map across Next.js hot reloads.
 * Without globalThis, Turbopack re-evaluates this module on every code change,
 * creating a new empty Map and losing all sessions.
 */

const globalForSessions = globalThis as unknown as { __sessions: Map<string, DeepResearchPlan> };
if (!globalForSessions.__sessions) {
    globalForSessions.__sessions = new Map();
}
const sessions = globalForSessions.__sessions;

/**
 * Creates a new research session with the Vertex AI generated plan.
 */
export async function createSession(originalQuery: string, plan: PlanStep[]): Promise<string> {
    const session_id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const session: DeepResearchPlan = {
        session_id,
        user_request: originalQuery,
        plan: plan,
        awaiting_confirmation: false,
        checkpoint_question: null,
        artifacts: {},
        final_output: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    sessions.set(session_id, session);
    console.log(`[StateEngine] ✅ Created session: ${session_id} (total sessions in memory: ${sessions.size})`);
    return session_id;
}

/**
 * Upserts a session, matching the requested firestore_upsert_session(session_id, patch_object).
 */
export async function firestore_upsert_session(session_id: string, patch_object: Partial<DeepResearchPlan>) {
    const session = sessions.get(session_id);
    if (!session) {
        console.error(`[StateEngine] ❌ Upsert failed: session ${session_id} not found! Keys: [${Array.from(sessions.keys()).join(', ')}]`);
        throw new Error(`Session ${session_id} does not exist`);
    }

    const updated = {
        ...session,
        ...patch_object,
        updatedAt: new Date().toISOString()
    };
    sessions.set(session_id, updated);
    console.log(`[StateEngine] Updated session: ${session_id}`);
}

/**
 * Retrieves the current session. Matches firestore_get_session(session_id).
 */
export async function firestore_get_session(session_id: string): Promise<DeepResearchPlan | null> {
    const session = sessions.get(session_id) || null;
    if (!session) {
        console.error(`[StateEngine] ❌ Session NOT FOUND: "${session_id}". Known sessions: [${Array.from(sessions.keys()).join(', ')}]`);
    }
    return session;
}

/**
 * Updates a specific subtask within a session.
 */
export async function updateSubTask(session_id: string, stepId: string, taskUpdates: Partial<PlanStep>) {
    const session = sessions.get(session_id);
    if (!session) {
        console.error(`[StateEngine] ❌ updateSubTask failed: session ${session_id} not found!`);
        throw new Error(`Session ${session_id} does not exist`);
    }

    const updatedPlan = session.plan.map((step: PlanStep) => {
        if (step.id === stepId) {
            return { ...step, ...taskUpdates };
        }
        return step;
    });

    const updatedSession: DeepResearchPlan = {
        ...session,
        plan: updatedPlan,
        updatedAt: new Date().toISOString()
    };

    sessions.set(session_id, updatedSession);
    console.log(`[StateEngine] Updated step ${stepId} → status: ${taskUpdates.status || 'unchanged'}`);
}
