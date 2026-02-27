import { DeepResearchPlan, PlanStep } from '@/types';

/**
 * Hybrid State Engine — Firestore with in-memory fallback
 * 
 * Tries Firestore first. If Firestore is unavailable (wrong project, 
 * missing permissions, not enabled), falls back to in-memory storage.
 * This ensures the hackathon demo works even without Firestore setup.
 */

let firestoreClient: any = null;
let firestoreAvailable = true; // Optimistic, will flip to false on first failure

// In-memory fallback store
const memoryStore: Map<string, DeepResearchPlan> = new Map();
const memoryStepData: Map<string, Record<string, any>> = new Map();

const COLLECTION_NAME = 'co_investigator_sessions';

// Lazy-init Firestore
function getFirestore() {
    if (firestoreClient) return firestoreClient;
    try {
        const { Firestore } = require('@google-cloud/firestore');
        firestoreClient = new Firestore({
            projectId: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
        });
        return firestoreClient;
    } catch (e) {
        console.warn('[StateEngine] ⚠️ Firestore client init failed, using in-memory store');
        firestoreAvailable = false;
        return null;
    }
}

/**
 * Creates a new research session.
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

    // Always save to memory first (guaranteed to work)
    memoryStore.set(session_id, JSON.parse(JSON.stringify(session)));

    // Try Firestore
    if (firestoreAvailable) {
        try {
            const db = getFirestore();
            if (db) {
                const docRef = db.collection(COLLECTION_NAME).doc(session_id);
                await docRef.set(session);
                console.log(`[StateEngine] ✅ Created session in Firestore: ${session_id}`);
            }
        } catch (error) {
            console.warn(`[StateEngine] ⚠️ Firestore create failed, using in-memory: ${error}`);
            firestoreAvailable = false;
        }
    } else {
        console.log(`[StateEngine] ✅ Created session in memory: ${session_id}`);
    }

    return session_id;
}

/**
 * Upserts (patches) a session.
 */
export async function firestore_upsert_session(session_id: string, patch_object: Partial<DeepResearchPlan>) {
    // Update memory store
    const memSession = memoryStore.get(session_id);
    if (memSession) {
        Object.assign(memSession, patch_object, { updatedAt: new Date().toISOString() });
        memoryStore.set(session_id, memSession);
    }

    // Try Firestore
    if (firestoreAvailable) {
        try {
            const db = getFirestore();
            if (db) {
                const docRef = db.collection(COLLECTION_NAME).doc(session_id);
                await docRef.update({ ...patch_object, updatedAt: new Date().toISOString() });
                console.log(`[StateEngine] Updated session in Firestore: ${session_id}`);
            }
        } catch (error) {
            console.warn(`[StateEngine] ⚠️ Firestore upsert failed (using memory): ${error}`);
            firestoreAvailable = false;
        }
    }
}

/**
 * Retrieves the current session.
 */
export async function firestore_get_session(session_id: string): Promise<DeepResearchPlan | null> {
    // Try Firestore first
    if (firestoreAvailable) {
        try {
            const db = getFirestore();
            if (db) {
                const docRef = db.collection(COLLECTION_NAME).doc(session_id);
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    const data = docSnap.data() as DeepResearchPlan;
                    // Sync to memory
                    memoryStore.set(session_id, JSON.parse(JSON.stringify(data)));
                    return data;
                }
            }
        } catch (error) {
            console.warn(`[StateEngine] ⚠️ Firestore get failed, falling back to memory: ${error}`);
            firestoreAvailable = false;
        }
    }

    // Fall back to memory
    const memSession = memoryStore.get(session_id);
    if (memSession) {
        console.log(`[StateEngine] ✅ Retrieved session from memory: ${session_id}`);
        return JSON.parse(JSON.stringify(memSession)); // Deep clone
    }

    console.error(`[StateEngine] ❌ Session NOT FOUND anywhere: "${session_id}"`);
    return null;
}

/**
 * Updates a specific subtask within a session.
 */
export async function updateSubTask(session_id: string, stepId: string, taskUpdates: Partial<PlanStep>) {
    // Update memory store
    const memSession = memoryStore.get(session_id);
    if (memSession) {
        memSession.plan = memSession.plan.map((step: PlanStep) => {
            if (step.id === stepId) return { ...step, ...taskUpdates };
            return step;
        });
        memSession.updatedAt = new Date().toISOString();
        memoryStore.set(session_id, memSession);
    }

    // Try Firestore
    if (firestoreAvailable) {
        try {
            const db = getFirestore();
            if (db) {
                const docRef = db.collection(COLLECTION_NAME).doc(session_id);
                const docSnap = await docRef.get();
                if (docSnap.exists) {
                    const session = docSnap.data() as DeepResearchPlan;
                    const updatedPlan = session.plan.map((step: PlanStep) => {
                        if (step.id === stepId) return { ...step, ...taskUpdates };
                        return step;
                    });
                    await docRef.update({ plan: updatedPlan, updatedAt: new Date().toISOString() });
                    console.log(`[StateEngine] Updated step ${stepId} in Firestore → status: ${taskUpdates.status || 'unchanged'}`);
                }
            }
        } catch (error) {
            console.warn(`[StateEngine] ⚠️ Firestore updateSubTask failed (using memory): ${error}`);
            firestoreAvailable = false;
        }
    } else {
        console.log(`[StateEngine] Updated step ${stepId} in memory → status: ${taskUpdates.status || 'unchanged'}`);
    }
}

/**
 * Saves raw tool output to subcollection (or memory).
 */
export async function saveStepRawData(session_id: string, stepId: string, rawData: Record<string, any>) {
    // Save to memory
    const key = `${session_id}:${stepId}`;
    memoryStepData.set(key, rawData);

    // Try Firestore
    if (firestoreAvailable) {
        try {
            const db = getFirestore();
            if (db) {
                const docRef = db.collection(COLLECTION_NAME).doc(session_id).collection('steps').doc(stepId);
                await docRef.set({ stepId, rawData, savedAt: new Date().toISOString() });
                console.log(`[StateEngine] 📦 Saved raw data for step ${stepId} (Firestore subcollection)`);
            }
        } catch (error) {
            console.warn(`[StateEngine] ⚠️ Firestore saveStepRawData failed (saved to memory): ${error}`);
            firestoreAvailable = false;
        }
    } else {
        console.log(`[StateEngine] 📦 Saved raw data for step ${stepId} (memory)`);
    }
}

/**
 * Retrieves raw tool output for a specific step.
 */
export async function getStepRawData(session_id: string, stepId: string): Promise<Record<string, any> | null> {
    // Try Firestore
    if (firestoreAvailable) {
        try {
            const db = getFirestore();
            if (db) {
                const docRef = db.collection(COLLECTION_NAME).doc(session_id).collection('steps').doc(stepId);
                const docSnap = await docRef.get();
                if (docSnap.exists) return docSnap.data()?.rawData || null;
            }
        } catch (error) {
            console.warn(`[StateEngine] ⚠️ Firestore getStepRawData failed: ${error}`);
            firestoreAvailable = false;
        }
    }

    // Fall back to memory
    const key = `${session_id}:${stepId}`;
    return memoryStepData.get(key) || null;
}
