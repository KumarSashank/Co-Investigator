import { NextResponse } from 'next/server';
import { updateSubTask, getSession } from '@/lib/firestore/stateEngine';
import { fetchDiseaseTargetsFromBigQuery } from '@/lib/bigquery';
import { fetchAuthorMetrics } from '@/lib/openalex';
import { fetchPubMedArticles } from '@/lib/pubmed';
import { queryPubTatorByTitle, fetchPubTatorAnnotations } from '@/lib/pubtator';
import { fetchProteinInteractions } from '@/lib/string';
import { DATASETS } from '@/lib/cloudData';

/**
 * POST /api/agent/execute
 * Executes a single sub-task from a research session.
 * 
 * Body: { sessionId: string, taskId: string }
 */
export async function POST(req: Request) {
    try {
        const { sessionId, taskId } = await req.json();

        if (!sessionId || !taskId) {
            return NextResponse.json({ error: 'sessionId and taskId are required' }, { status: 400 });
        }

        const session = await getSession(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const task = session.plan.find(t => t.id === taskId);
        if (!task) {
            return NextResponse.json({ error: 'Task not found in session' }, { status: 404 });
        }

        // Mark as in-progress
        await updateSubTask(sessionId, taskId, { status: 'in_progress' });

        let resultData: any = null;

        try {
            // Helper to extract keywords like "for Multiple Sclerosis" or "author John Doe"
            const extract = (regex: RegExp) => task.description.match(regex)?.[1]?.trim();

            // Execute the appropriate tool
            switch (task.toolToUse) {
                case 'bigquery':
                    const disease = extract(/for (.*)/i) || extract(/about (.*)/i) || 'cancer';
                    resultData = await fetchDiseaseTargetsFromBigQuery(disease);
                    break;

                case 'openalex':
                    const author = extract(/author (.*)/i) || extract(/for (.*)/i) || 'john_doe';
                    resultData = await fetchAuthorMetrics(author);
                    break;

                case 'pubmed':
                    const pQuery = extract(/query (.*)/i) || extract(/for (.*)/i) || extract(/about (.*)/i) || 'biomedicine';
                    resultData = await fetchPubMedArticles(pQuery);
                    break;

                case 'pubtator':
                    const pmidMatch = task.description.match(/PMID[:\s]+(\d+)/i);
                    if (pmidMatch) {
                        resultData = await fetchPubTatorAnnotations(pmidMatch[1]);
                    } else {
                        const titleQuery = extract(/for (.*)/i) || extract(/about (.*)/i) || task.description;
                        resultData = await queryPubTatorByTitle(titleQuery);
                    }
                    break;

                case 'datasets':
                    const protein = extract(/protein (.*)/i) || extract(/for (.*)/i);
                    if (protein) {
                        // Use STRING interaction data
                        resultData = await fetchProteinInteractions(protein);
                    } else {
                        resultData = {
                            message: "Discovery: Browsing available GCS datasets",
                            availableDatasets: DATASETS
                        };
                    }
                    break;

                default:
                    resultData = { message: "No tool required or tool not yet implemented" };
            }

            // Update subtask with results and mark as completed
            await updateSubTask(sessionId, taskId, {
                status: 'completed',
                resultData
            });

            return NextResponse.json({ status: 'success', data: resultData });

        } catch (execError: any) {
            console.error(`Execution error for task ${taskId}:`, execError);
            await updateSubTask(sessionId, taskId, { status: 'failed' });
            return NextResponse.json({ error: execError.message }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Agent Execution Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
