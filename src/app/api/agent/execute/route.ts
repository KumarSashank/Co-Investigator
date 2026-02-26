import { NextResponse } from 'next/server';
import { firestore_get_session, firestore_upsert_session, updateSubTask } from '@/lib/firestore/stateEngine';
import { gcs_write } from '@/lib/gcs';
import { logger } from '@/lib/logger';
import { pubmed_search, pubmed_fetch } from '@/lib/pubmed';
import { openalex_search_authors, openalex_get_author } from '@/lib/openalex';

const LOG = '🤖 [Execute]';

export async function POST(req: Request) {
    logger.info(`\n${'═'.repeat(60)}`);

    try {
        const { sessionId, taskId, toolParams } = await req.json();
        logger.info({ sessionId, taskId }, `${LOG} Execution requested`);

        if (!sessionId || !taskId) {
            return NextResponse.json({ error: 'sessionId and taskId are required' }, { status: 400 });
        }

        // 1. Fetch current session state
        const session = await firestore_get_session(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const step = session.plan.find(t => t.id === taskId);
        if (!step) {
            return NextResponse.json({ error: 'Task not found in session plan' }, { status: 404 });
        }

        logger.info(`${LOG} Executing Tool(s): ${step.tools.join(', ')} | Intent: ${step.intent}`);

        // Handle explicit hitl_pause tool requested in the plan
        if (step.tools.includes('hitl_pause')) {
            logger.info(`${LOG} ⏸️ HITL Pause requested by plan`);

            // Mark step as running so it pauses here, but we set session awaiting_confirmation
            await updateSubTask(sessionId, taskId, { status: 'RUNNING' });
            await firestore_upsert_session(sessionId, {
                awaiting_confirmation: true,
                checkpoint_question: step.inputs.question || "Do you want to proceed?",
                checkpoint_options: step.inputs.options || ["Yes", "No"]
            });

            return NextResponse.json({
                status: 'hitl_paused',
                taskId,
                question: step.inputs.question,
                options: step.inputs.options
            });
        }

        // 2. Mark step RUNNING
        await updateSubTask(sessionId, taskId, { status: 'RUNNING' });

        // 3. Execute the appropriate tools and collect results
        const combinedResults: Record<string, any> = {};

        for (const toolName of step.tools) {
            logger.info(`${LOG} Running specific tool: ${toolName}`);

            try {
                if (toolName === 'pubmed_search') {
                    const res = await pubmed_search(step.inputs.query, step.inputs.from_year, step.inputs.to_year);
                    combinedResults.pubmed_search = res;
                }
                else if (toolName === 'pubmed_fetch') {
                    // It can get pmids directly from inputs or from a previous step's artifact...
                    // For now, assume inputs.pmids
                    const pmids = step.inputs.pmids || [];
                    const res = await pubmed_fetch(pmids);
                    combinedResults.pubmed_fetch = res;
                }
                else if (toolName === 'openalex_search_authors') {
                    const res = await openalex_search_authors(step.inputs.query, step.inputs.from_year, step.inputs.to_year, step.inputs.keywords);
                    combinedResults.openalex_search_authors = res;
                }
                else if (toolName === 'openalex_get_author') {
                    const res = await openalex_get_author(step.inputs.author_id);
                    combinedResults.openalex_get_author = res;
                }
                else if (toolName === 'bigquery') {
                    // Call our internal hackathon api as a fallback wrapper for now, 
                    // or implement direct BQ call here if needed
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
                    const disease = step.inputs.disease || step.inputs.query || session.user_request;
                    const bqRes = await fetch(`${baseUrl}/api/tools/bigquery?disease=${encodeURIComponent(disease)}`);
                    combinedResults.bigquery = await bqRes.json();
                }
                else if (toolName === 'none') {
                    combinedResults.none = { message: 'Synthesis step triggered' };
                }
                else if (toolName === 'vertex_search_retrieve') {
                    // Since we don't have the real Vertex Search Datastore UUID right now, mock it
                    combinedResults.vertex_search_retrieve = {
                        message: "Vertex Search grounding will be applied at final report generation time."
                    };
                }
            } catch (toolError: any) {
                logger.error({ toolName, error: toolError.message }, `${LOG} ❌ Tool failed`);
                combinedResults[toolName] = { error: toolError.message };
            }
        }

        // 4. Write raw tool outputs to GCS (simulate DeepResearch observability)
        const gcsPath = `runs/${sessionId}/${taskId}.json`;
        let artifactUri = '';
        try {
            artifactUri = await gcs_write(gcsPath, combinedResults);

            // Update session artifacts dictionary
            const sessionArtifacts = session.artifacts || {};
            sessionArtifacts[taskId] = artifactUri;
            await firestore_upsert_session(sessionId, { artifacts: sessionArtifacts });
        } catch (gcsError: any) {
            logger.error({ error: gcsError.message }, `${LOG} ❌ GCS Write Failed. Continuing anyway...`);
            artifactUri = `error://gcs_write_failed`;
        }

        // 5. Mark task DONE
        await updateSubTask(sessionId, taskId, {
            status: 'DONE',
            result_data: combinedResults // Kept in state for local rendering convenience
        });

        logger.info(`${LOG} ✅ Task ${taskId} DONE. Artifact Written: ${artifactUri}`);

        return NextResponse.json({
            status: 'success',
            taskId,
            artifactUri,
            result: combinedResults
        });

    } catch (error: any) {
        logger.error({ err: error.message, stack: error.stack }, `${LOG} ❌ FATAL EXECUTION ERROR`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        logger.info(`${'═'.repeat(60)}\n`);
    }
}
