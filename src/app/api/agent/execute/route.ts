import { NextResponse } from 'next/server';
import { firestore_get_session, firestore_upsert_session, updateSubTask, saveStepRawData } from '@/lib/firestore/stateEngine';
import { gcs_write } from '@/lib/gcs';
import { logger } from '@/lib/logger';
import { pubmed_search, pubmed_fetch } from '@/lib/pubmed';
import { openalex_search_authors, openalex_get_author } from '@/lib/openalex';
import { runStepAgent } from '@/lib/vertex/stepAgent';

const LOG = '🤖 [Execute]';

/**
 * Looks through previous completed steps to find data for cross-step chaining.
 */
function findPreviousStepData(session: any, currentStepId: string): Record<string, any> {
    const allResults: Record<string, any> = {};
    for (const step of session.plan) {
        if (step.id === currentStepId) break;
        if (step.status === 'DONE' && step.result_data) {
            allResults[step.id] = step.result_data;
        }
    }
    return allResults;
}

/**
 * Collects AI analyses from previous completed steps.
 */
function findPreviousAgentAnalyses(session: any, currentStepId: string): Record<string, any> {
    const analyses: Record<string, any> = {};
    for (const step of session.plan) {
        if (step.id === currentStepId) break;
        if (step.status === 'DONE' && step.result_data?.ai_analysis) {
            analyses[step.id] = {
                agent_name: step.result_data.ai_analysis.agent_name,
                intent: step.intent,
                analysis: step.result_data.ai_analysis
            };
        }
    }
    return analyses;
}

export async function POST(req: Request) {
    logger.info(`\n${'═'.repeat(60)}`);

    try {
        const { sessionId, taskId } = await req.json();
        logger.info({ sessionId, taskId }, `${LOG} Execution requested`);

        if (!sessionId || !taskId) {
            return NextResponse.json({ error: 'sessionId and taskId are required' }, { status: 400 });
        }

        // 1. Fetch current session state
        const session = await firestore_get_session(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const step = session.plan.find((t: any) => t.id === taskId);
        if (!step) {
            return NextResponse.json({ error: 'Task not found in session plan' }, { status: 404 });
        }

        logger.info(`${LOG} Step: "${step.name}" | Tools: [${step.tools.join(', ')}] | Intent: ${step.intent}`);

        // Handle explicit hitl_pause tool
        if (step.tools.includes('hitl_pause')) {
            logger.info(`${LOG} ⏸️ HITL Pause requested`);
            await updateSubTask(sessionId, taskId, { status: 'RUNNING' });
            await firestore_upsert_session(sessionId, {
                awaiting_confirmation: true,
                checkpoint_question: step.inputs.question || "Do you want to proceed?",
                checkpoint_options: step.inputs.options || ["Approve & Proceed", "Cancel Execution"]
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

        // 3. Gather previous step outputs for cross-step chaining
        const previousData = findPreviousStepData(session, taskId);
        logger.info(`${LOG} Previous step data available from: [${Object.keys(previousData).join(', ')}]`);

        // 4. Execute the appropriate tools
        const combinedResults: Record<string, any> = {};
        const baseUrl = `http://localhost:${process.env.PORT || '3000'}`;

        for (const toolName of step.tools) {
            logger.info(`${LOG} 🔧 Running tool: ${toolName}`);
            logger.info(`${LOG}    Inputs: ${JSON.stringify(step.inputs)}`);

            try {
                if (toolName === 'pubmed_search') {
                    const query = step.inputs.query || step.inputs.pubmed_query || session.user_request;
                    const fromYear = step.inputs.from_year || (new Date().getFullYear() - 3);
                    logger.info(`${LOG}    📄 PubMed query: "${query}" | from_year: ${fromYear}`);
                    const res = await pubmed_search(query, fromYear, step.inputs.to_year);
                    combinedResults.pubmed_search = res;
                    logger.info(`${LOG}    → Found ${res.length} PMIDs`);
                }
                else if (toolName === 'pubmed_fetch') {
                    let pmids = step.inputs.pmids || [];
                    if (pmids === 'CHAIN_FROM_PREVIOUS' || (Array.isArray(pmids) && pmids.length === 0)) {
                        pmids = [];
                        for (const data of Object.values(previousData)) {
                            if (data.pubmed_search && Array.isArray(data.pubmed_search) && data.pubmed_search.length > 0) {
                                pmids = data.pubmed_search;
                                logger.info(`${LOG}    → Chained ${pmids.length} PMIDs from previous step`);
                                break;
                            }
                        }
                    }
                    if (pmids.length === 0) {
                        logger.warn(`${LOG}    ⚠️ No PMIDs available — skipping`);
                        combinedResults.pubmed_fetch = { warning: 'No PMIDs to fetch' };
                    } else {
                        const res = await pubmed_fetch(pmids.slice(0, 10));
                        combinedResults.pubmed_fetch = res;
                        logger.info(`${LOG}    → Fetched ${res.length} detailed articles`);
                    }
                }
                else if (toolName === 'openalex_search_authors') {
                    const query = step.inputs.query || session.user_request;
                    const res = await openalex_search_authors(query, step.inputs.from_year, step.inputs.to_year, step.inputs.keywords);
                    combinedResults.openalex_search_authors = res;
                    logger.info(`${LOG}    → Found ${res.length} candidate authors`);
                }
                else if (toolName === 'openalex_get_author') {
                    let authorId = step.inputs.author_id;
                    const authorIds: string[] = [];

                    if (!authorId || authorId === 'FROM_PREVIOUS_STEP' || authorId === 'CHAIN_FROM_PREVIOUS' || authorId === '') {
                        for (const data of Object.values(previousData)) {
                            if (data.openalex_search_authors && Array.isArray(data.openalex_search_authors)) {
                                for (const candidate of data.openalex_search_authors.slice(0, 5)) {
                                    if (candidate.authorId) authorIds.push(candidate.authorId);
                                }
                                break;
                            }
                        }

                        if (authorIds.length === 0) {
                            combinedResults.openalex_get_author = { warning: 'No author IDs found' };
                        } else {
                            const detailedAuthors = [];
                            for (const aid of authorIds) {
                                try {
                                    const detail = await openalex_get_author(aid);
                                    detailedAuthors.push(detail);
                                } catch (e: any) {
                                    logger.error(`${LOG}    ❌ Failed to fetch author ${aid}: ${e.message}`);
                                }
                            }
                            combinedResults.openalex_get_author = detailedAuthors;
                            logger.info(`${LOG}    → Retrieved ${detailedAuthors.length} detailed author profiles`);
                        }
                    } else {
                        const detail = await openalex_get_author(authorId);
                        combinedResults.openalex_get_author = detail;
                    }
                }
                else if (toolName === 'bigquery') {
                    const disease = step.inputs.disease || step.inputs.query || session.user_request;
                    const bqRes = await fetch(`${baseUrl}/api/tools/bigquery?disease=${encodeURIComponent(disease)}`);
                    combinedResults.bigquery = await bqRes.json();
                }
                else if (toolName === 'none') {
                    combinedResults.none = { message: 'Synthesis step triggered' };
                }
                else if (toolName === 'vertex_search_retrieve') {
                    combinedResults.vertex_search_retrieve = {
                        message: "Vertex Search grounding applied at report generation."
                    };
                }
                else {
                    logger.warn(`${LOG}    ⚠️ Unknown tool: ${toolName} — skipping`);
                    combinedResults[toolName] = { warning: `Unknown tool: ${toolName}` };
                }
            } catch (toolError: any) {
                logger.error({ toolName, error: toolError.message }, `${LOG} ❌ Tool failed`);
                combinedResults[toolName] = { error: toolError.message };
            }
        }

        // 5. Run the Step-Level Specialist Agent (graceful fallback if unavailable)
        let aiAnalysis: any = null;
        try {
            logger.info(`${LOG} 🧬 Invoking specialist agent for intent: ${step.intent}`);
            const previousAnalyses = findPreviousAgentAnalyses(session, taskId);
            aiAnalysis = await runStepAgent(step.intent, combinedResults, previousAnalyses, session.user_request);
            logger.info(`${LOG} 🧬 Agent completed. Confidence: ${aiAnalysis.confidence || 'N/A'}`);
        } catch (agentError: any) {
            logger.warn(`${LOG} ⚠️ Specialist agent unavailable: ${agentError.message}. Storing raw results directly.`);
            aiAnalysis = {
                agent_name: `fallback_${step.intent}`,
                confidence: 'N/A',
                summary: `Tool execution completed. Raw data collected from: ${step.tools.join(', ')}`,
                raw_fallback: true
            };
        }

        // 6. Save raw data to Firestore subcollection
        try {
            await saveStepRawData(sessionId, taskId, combinedResults);
        } catch (e: any) {
            logger.warn(`${LOG} ⚠️ Raw data save failed (non-fatal): ${e.message}`);
        }

        // 7. Write to GCS as backup
        let artifactUri = '';
        try {
            const gcsPath = `runs/${sessionId}/${taskId}.json`;
            artifactUri = await gcs_write(gcsPath, combinedResults);
            const sessionArtifacts = session.artifacts || {};
            sessionArtifacts[taskId] = artifactUri;
            await firestore_upsert_session(sessionId, { artifacts: sessionArtifacts });
        } catch (gcsError: any) {
            logger.warn(`${LOG} ⚠️ GCS write failed (non-fatal): ${gcsError.message}`);
            artifactUri = 'local://no-gcs';
        }

        // 8. Mark task DONE — store both AI summary AND raw tool data
        const stepSummary = {
            ai_analysis: aiAnalysis,
            tools_used: step.tools,
            data_counts: {
                pubmed_results: combinedResults.pubmed_search?.length || combinedResults.pubmed_fetch?.length || 0,
                openalex_authors: combinedResults.openalex_search_authors?.length || combinedResults.openalex_get_author?.length || 0,
                bigquery_targets: combinedResults.bigquery?.associatedTargets?.length || 0,
            },
            artifact_uri: artifactUri,
            // CRITICAL: Also store raw tool data so the report can synthesize it
            raw_data: combinedResults,
        };

        await updateSubTask(sessionId, taskId, {
            status: 'DONE',
            result_data: stepSummary
        });

        logger.info(`${LOG} ✅ Step ${taskId} DONE. Summary + raw data stored.`);

        return NextResponse.json({
            status: 'success',
            taskId,
            artifactUri,
            result: stepSummary
        });

    } catch (error: any) {
        logger.error({ err: error.message, stack: error.stack }, `${LOG} ❌ FATAL EXECUTION ERROR`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        logger.info(`${'═'.repeat(60)}\n`);
    }
}
