import { DeepResearchPlan, PlanStep } from '@/types';
import { Firestore } from '@google-cloud/firestore';

/**
 * Real Firestore State Engine
 * 
 * Uses @google-cloud/firestore with Google Application Default Credentials.
 * Sessions are stored in the "co_investigator_sessions" collection.
 */

const firestore = new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986',
});

const COLLECTION_NAME = 'co_investigator_sessions';

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

    const docRef = firestore.collection(COLLECTION_NAME).doc(session_id);
    await docRef.set(session);

    console.log(`[StateEngine] ✅ Created session in Firestore: ${session_id}`);
    return session_id;
}

/**
 * Upserts a session, matching the requested firestore_upsert_session(session_id, patch_object).
 */
export async function firestore_upsert_session(session_id: string, patch_object: Partial<DeepResearchPlan>) {
    const docRef = firestore.collection(COLLECTION_NAME).doc(session_id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        console.error(`[StateEngine] ❌ Upsert failed: session ${session_id} not found in Firestore!`);
        throw new Error(`Session ${session_id} does not exist`);
    }

    const updatedData = {
        ...patch_object,
        updatedAt: new Date().toISOString()
    };

    await docRef.update(updatedData);
    console.log(`[StateEngine] Updated session in Firestore: ${session_id}`);
}

/**
 * Retrieves the current session. Matches firestore_get_session(session_id).
 */
export async function firestore_get_session(session_id: string): Promise<DeepResearchPlan | null> {
    try {
        const docRef = firestore.collection(COLLECTION_NAME).doc(session_id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            console.error(`[StateEngine] ❌ Session NOT FOUND in Firestore: "${session_id}"`);
            return null;
        }

        return docSnap.data() as DeepResearchPlan;
    } catch (error) {
        console.error(`[StateEngine] ❌ Error fetching session "${session_id}" from Firestore:`, error);
        return null;
    }
}

/**
 * Updates a specific subtask within a session.
 */
export async function updateSubTask(session_id: string, stepId: string, taskUpdates: Partial<PlanStep>) {
    const docRef = firestore.collection(COLLECTION_NAME).doc(session_id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
        console.error(`[StateEngine] ❌ updateSubTask failed: session ${session_id} not found in Firestore!`);
        throw new Error(`Session ${session_id} does not exist`);
    }

    const session = docSnap.data() as DeepResearchPlan;

    const updatedPlan = session.plan.map((step: PlanStep) => {
        if (step.id === stepId) {
            return { ...step, ...taskUpdates };
        }
        return step;
    });

    await docRef.update({
        plan: updatedPlan,
        updatedAt: new Date().toISOString()
    });

    console.log(`[StateEngine] Updated step ${stepId} in Firestore → status: ${taskUpdates.status || 'unchanged'}`);
}

/**
 * Saves the FULL raw tool output to a Firestore subcollection.
 * Path: co_investigator_sessions/{session_id}/steps/{stepId}
 * This keeps the main session document small (only AI summaries).
 */
export async function saveStepRawData(session_id: string, stepId: string, rawData: Record<string, any>) {
    try {
        const docRef = firestore
            .collection(COLLECTION_NAME)
            .doc(session_id)
            .collection('steps')
            .doc(stepId);

        await docRef.set({
            stepId,
            rawData,
            savedAt: new Date().toISOString()
        });

        console.log(`[StateEngine] 📦 Saved raw data for step ${stepId} (subcollection)`);
    } catch (error) {
        console.error(`[StateEngine] ❌ Failed to save raw data for step ${stepId}:`, error);
    }
}

/**
 * Retrieves the full raw tool output for a specific step.
 * Called on-demand when user clicks "View Details" in the UI.
 */
export async function getStepRawData(session_id: string, stepId: string): Promise<Record<string, any> | null> {
    try {
        const docRef = firestore
            .collection(COLLECTION_NAME)
            .doc(session_id)
            .collection('steps')
            .doc(stepId);

        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            console.error(`[StateEngine] ❌ Raw data NOT FOUND for step ${stepId}`);
            return null;
        }

        return docSnap.data()?.rawData || null;
    } catch (error) {
        console.error(`[StateEngine] ❌ Error fetching raw data for step ${stepId}:`, error);
        return null;
    }
}
