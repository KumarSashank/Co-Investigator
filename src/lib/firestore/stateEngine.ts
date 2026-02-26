import { DeepResearchPlan, PlanStep } from '@/types';

/**
 * In-Memory State Engine (Mocking Firestore)
 * 
 * Uses a simple Map to store sessions in server memory.
 * This works perfectly for local development and hackathon demos.
 * Implements the required firestore_upsert_session and firestore_get_session signatures.
 */

const sessions = new Map<string, DeepResearchPlan>();

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
    console.log(`[StateEngine] Created session: ${session_id}`);
    return session_id;
}

/**
 * Upserts a session, matching the requested firestore_upsert_session(session_id, patch_object).
 */
export async function firestore_upsert_session(session_id: string, patch_object: Partial<DeepResearchPlan>) {
    const session = sessions.get(session_id);
    if (!session) throw new Error(`Session ${session_id} does not exist`);

    const updated = {
        ...session,
        ...patch_object,
        updatedAt: new Date().toISOString()
    };
    sessions.set(session_id, updated);

    const statusMsg = updated.awaiting_confirmation ? 'HITL_PAUSED' : 'RUNNING';
    console.log(`[StateEngine] Upserted session: ${session_id} | Status: ${statusMsg}`);
}

/**
 * Retrieves the current session. Matches firestore_get_session(session_id).
 */
export async function firestore_get_session(session_id: string): Promise<DeepResearchPlan | null> {
    return sessions.get(session_id) || null;
}

/**
 * Updates a specific subtask within a session.
 */
export async function updateSubTask(session_id: string, stepId: string, taskUpdates: Partial<PlanStep>) {
    const session = sessions.get(session_id);
    if (!session) throw new Error(`Session ${session_id} does not exist`);

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
    console.log(`[StateEngine] Updated step ${stepId} in session ${session_id} to status: ${taskUpdates.status || 'unchanged'}`);
}
