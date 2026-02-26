'use client';

// Make sure to import the interfaces defined by the Architect in shared_context.md
// import { SubTask } from '../../context/shared_context.md'; 

// Instruction to Frontend UI Developer (Cursor):
// 1. You will receive an array of these 'SubTask' objects from the Backend.
// 2. Render them as a beautiful interactive checklist.
// 3. Implement the 'HITL Checkpoint' UI. When a task pauses, show an 'Approve' or 'Cancel' button.
export default function TaskTracker() {

    // Mock data representing the Vertex AI Planner output
    const mockPlan = [
        { id: '1', description: 'Query BigQuery for IPF target evidence', toolToUse: 'bigquery', status: 'completed' },
        { id: '2', description: 'Fetch recent IPF publications from PubMed', toolToUse: 'pubmed', status: 'in_progress' },
        { id: '3', description: 'Identify active researchers via OpenAlex', toolToUse: 'openalex', status: 'pending' },
    ];

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '⏳';
            case 'pending': return '⚪';
            case 'failed': return '❌';
            default: return '⚪';
        }
    };

    return (
        <div className="space-y-4">
            {mockPlan.map((task) => (
                <div key={task.id} className={`p-4 rounded-xl border ${task.status === 'in_progress' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex items-start gap-3">
                        <span className="text-xl">{getStatusIcon(task.status)}</span>
                        <div>
                            <p className="font-medium text-gray-900 text-sm">{task.description}</p>
                            <span className="inline-block mt-2 px-2 py-1 bg-gray-200 text-xs text-gray-600 rounded">Tool: {task.toolToUse}</span>
                        </div>
                    </div>
                </div>
            ))}

            {/* HITL Checkpoint Mock UI */}
            <div className="mt-8 p-5 bg-yellow-50 border border-yellow-200 rounded-xl">
                <h3 className="font-semibold text-yellow-800 mb-2">Human-in-the-Loop Checkpoint</h3>
                <p className="text-sm text-yellow-700 mb-4">The agent is requesting permission to execute the OpenAlex query. Do you want to proceed?</p>
                <div className="flex gap-2">
                    <button className="flex-1 bg-green-600 text-white py-2 rounded font-medium hover:bg-green-700">Approve</button>
                    <button className="flex-1 bg-red-100 text-red-700 py-2 rounded font-medium hover:bg-red-200">Deny</button>
                </div>
            </div>
        </div>
    );
}
