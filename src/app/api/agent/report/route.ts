import { NextResponse } from 'next/server';
import { VertexAI } from '@google-cloud/vertexai';
import { firestore_get_session, firestore_upsert_session } from '@/lib/firestore/stateEngine';
import { logger } from '@/lib/logger';

const vertexAI = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
    location: 'us-central1'
});

const generativeModel = vertexAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} } as any]
});

const LOG = '🧠 [Report]';

const REPORT_SYSTEM_INSTRUCTION = `
You are Co-Investigator, a high-level research intern.
Synthesize all collected data into a comprehensive markdown research report.

CRITICAL: Output EXACTLY these sections:

## Executive Summary
3-5 sentence overview with inline citations [Source: PubMed PMID:xxx] or [Source: OpenAlex].

## Disease / Topic Synthesis
Grounded summary of findings. Every claim MUST have a citation.

## Top Researchers
Summary table:
| Rank | Name | Institution | h-index | Citations | Works | Publications (in window) |
Then detailed profiles for each with: publications, affiliations, relevance explanation.

## Key Publications
List of most relevant publications with: Title, Authors, Year, PMID/DOI, Citation count.

## Methods & Search Workflow
What databases were searched, what queries were used, date ranges.

## Sources & References
Numbered reference list.

## Next-Step Suggestions
2-3 logical next steps.

STRICT RULES:
- NEVER invent DOIs, PMIDs, author names, emails, or affiliations.
- Use data verbatim from the provided artifacts.
- If data is unavailable, say "[Data not available from retrieved sources]"
`;

// ============================================================
// COMPREHENSIVE TEMPLATE-BASED REPORT (when Gemini is unavailable)
// ============================================================
function generateTemplateReport(session: any): string {
    const query = session.user_request || 'Research query';
    const steps = session.plan || [];

    // Collect ALL raw data from steps
    let bigqueryData: any = null;
    let pubmedArticles: any[] = [];
    let pubmedPMIDs: string[] = [];
    let openalexAuthors: any[] = [];
    let openalexDetailed: any[] = [];

    for (const step of steps) {
        const raw = step.result_data?.raw_data || step.result_data || {};

        if (raw.bigquery) bigqueryData = raw.bigquery;
        if (raw.pubmed_search && Array.isArray(raw.pubmed_search)) pubmedPMIDs = raw.pubmed_search;
        if (raw.pubmed_fetch && Array.isArray(raw.pubmed_fetch)) pubmedArticles = raw.pubmed_fetch;
        if (raw.openalex_search_authors && Array.isArray(raw.openalex_search_authors)) openalexAuthors = raw.openalex_search_authors;
        if (raw.openalex_get_author) {
            if (Array.isArray(raw.openalex_get_author)) openalexDetailed = raw.openalex_get_author;
            else if (raw.openalex_get_author.displayName) openalexDetailed = [raw.openalex_get_author];
        }
    }

    // Use whichever author list has data
    const researchers = openalexDetailed.length > 0 ? openalexDetailed : openalexAuthors;
    const targets = bigqueryData?.associatedTargets || [];
    const pathways = bigqueryData?.pathways || [];
    const currentYear = new Date().getFullYear();

    // ── Executive Summary ──
    let report = `## Executive Summary\n\n`;
    report += `This report was compiled by the Co-Investigator AI agent in response to the query: **"${query}"**. `;
    report += `The investigation followed a multi-step agentic workflow querying ${targets.length > 0 ? 'BigQuery disease-target datasets, ' : ''}`;
    report += `PubMed for recent publications${pubmedPMIDs.length > 0 ? ` (${pubmedPMIDs.length} articles identified)` : ''}, `;
    report += `and OpenAlex for active researchers${researchers.length > 0 ? ` (${researchers.length} candidate researchers ranked)` : ''}. `;
    if (targets.length > 0) {
        report += `Key gene targets identified include **${targets.slice(0, 3).map((t: any) => t.targetSymbol).join('**, **')}** with evidence scores ranging from ${targets[targets.length - 1]?.evidenceScore?.toFixed(2) || '0.5'} to ${targets[0]?.evidenceScore?.toFixed(2) || '1.0'}.`;
    }
    report += `\n\n`;

    // ── Plan & Steps Taken ──
    report += `## Plan & Steps Taken\n\n`;
    report += `| Step | Name | Tools | Status |\n`;
    report += `|------|------|-------|--------|\n`;
    for (const step of steps) {
        const status = step.status === 'DONE' ? '✅ Done' : step.status === 'FAILED' ? '❌ Failed' : step.status;
        report += `| ${step.id} | ${step.name} | ${step.tools?.join(', ') || '-'} | ${status} |\n`;
    }
    report += `\n`;

    // ── Disease / Topic Synthesis ──
    report += `## Disease / Topic Synthesis\n\n`;
    if (targets.length > 0) {
        report += `### Key Genetic Targets & Associations\n\n`;
        report += `Based on data retrieved from BigQuery (CIViC and PrimeKG datasets), the following gene targets were identified as having the strongest association with the queried disease/topic:\n\n`;
        report += `| Rank | Gene Target | Evidence Score | Ensembl ID |\n`;
        report += `|------|-------------|----------------|------------|\n`;
        targets.forEach((t: any, i: number) => {
            report += `| ${i + 1} | **${t.targetSymbol}** | ${t.evidenceScore?.toFixed(2) || 'N/A'} | ${t.targetId || 'N/A'} |\n`;
        });
        report += `\n`;

        if (pathways.length > 0) {
            report += `### Relevant Biological Pathways\n\n`;
            pathways.forEach((p: string) => {
                report += `- ${p}\n`;
            });
            report += `\n`;
        }
    } else {
        report += `No disease-target association data was retrieved from BigQuery for this query. `;
        report += `The analysis below relies on PubMed publications and OpenAlex researcher data.\n\n`;
    }

    // ── Top Researchers ──
    report += `## Top Researchers\n\n`;
    if (researchers.length > 0) {
        report += `The following researchers were identified as the most active and impactful in this research area, ranked by a composite score incorporating publication recency, citation impact, and relevance to the query.\n\n`;

        // Summary table
        report += `| Rank | Name | Institution | h-index | Citations | Works | Activity |\n`;
        report += `|------|------|-------------|---------|-----------|-------|----------|\n`;
        researchers.slice(0, 15).forEach((r: any, i: number) => {
            const name = r.displayName || 'Unknown';
            const inst = r.currentInstitution || 'Unknown';
            const hIndex = r.metrics?.hIndex || r.hIndex || '-';
            const citations = r.metrics?.citedByCount || r.citedByCount || '-';
            const works = r.metrics?.worksCount || r.worksCount || '-';
            const activity = r.activityLevel || '-';
            report += `| ${i + 1} | **${name}** | ${inst} | ${hIndex} | ${citations} | ${works} | ${activity} |\n`;
        });
        report += `\n`;

        // Detailed profiles
        report += `### Detailed Researcher Profiles\n\n`;
        researchers.slice(0, 10).forEach((r: any, i: number) => {
            const name = r.displayName || 'Unknown';
            const inst = r.currentInstitution || 'Unknown';
            const profileUrl = r.profileUrl || '';

            report += `#### ${i + 1}. ${name} — ${inst}\n\n`;
            if (profileUrl) report += `- **OpenAlex Profile**: [${profileUrl}](${profileUrl})\n`;
            report += `- **Metrics**: h-index: ${r.metrics?.hIndex || '-'} | Total citations: ${r.metrics?.citedByCount || '-'} | Total works: ${r.metrics?.worksCount || '-'}\n`;
            report += `- **Activity Level**: ${r.activityLevel || 'Unknown'}\n`;
            report += `- **Last Relevant Work Year**: ${r.lastRelevantWorkYear || 'Unknown'}\n`;
            report += `- **Relevance Score**: ${r.score?.toFixed(3) || 'N/A'}\n`;

            if (r.recentPublications && r.recentPublications.length > 0) {
                report += `- **Key Recent Publications**:\n`;
                r.recentPublications.slice(0, 5).forEach((pub: any) => {
                    const title = pub.title || 'Untitled';
                    const year = pub.year || 'Unknown';
                    const citations = pub.citationCount || 0;
                    const doi = pub.doi ? `[DOI](${pub.doi})` : '';
                    const url = pub.url ? `[Link](${pub.url})` : '';
                    report += `  - "${title}" (${year}) — ${citations} citations ${doi || url}\n`;
                });
            }
            report += `\n`;
        });
    } else {
        report += `No researchers were identified via OpenAlex for this query. Consider broadening the search terms or checking the OpenAlex API connectivity.\n\n`;
    }

    // ── Key Publications ──
    report += `## Key Publications\n\n`;
    if (pubmedArticles.length > 0) {
        report += `The following publications were retrieved from PubMed and represent the most recent research relevant to the query:\n\n`;
        pubmedArticles.slice(0, 10).forEach((a: any, i: number) => {
            const authors = a.authors?.slice(0, 3).join(', ') || 'Unknown authors';
            const moreAuthors = a.authors?.length > 3 ? ' et al.' : '';
            report += `${i + 1}. **${a.title || 'Untitled'}**\n`;
            report += `   - Authors: ${authors}${moreAuthors}\n`;
            report += `   - Published: ${a.publicationDate || 'Unknown'}\n`;
            report += `   - PMID: [${a.pmid}](https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/)\n`;
            if (a.affiliations?.length > 0) {
                report += `   - Affiliation: ${a.affiliations[0]}\n`;
            }
            if (a.correspondingEmail) {
                report += `   - Contact: ${a.correspondingEmail}\n`;
            }
            report += `\n`;
        });
    } else if (pubmedPMIDs.length > 0) {
        report += `${pubmedPMIDs.length} PubMed articles were identified. PMIDs: ${pubmedPMIDs.slice(0, 10).join(', ')}${pubmedPMIDs.length > 10 ? '...' : ''}\n\n`;
        report += `Full article details can be retrieved from [PubMed](https://pubmed.ncbi.nlm.nih.gov/).\n\n`;
    } else {
        report += `No PubMed publications were retrieved for this specific query. Consider broadening the search terms.\n\n`;
    }

    // ── Methods ──
    report += `## Methods & Search Workflow\n\n`;
    report += `This report was generated through a multi-step agentic workflow:\n\n`;
    report += `1. **Disease Grounding** — BigQuery was queried against the CIViC clinical evidence and PrimeKG knowledge graph datasets to identify disease-target associations.\n`;
    report += `2. **Literature Search** — PubMed E-utilities (esearch + efetch) were used to find recent publications, extracting titles, authors, affiliations, and corresponding author emails from Medline XML.\n`;
    report += `3. **Researcher Discovery** — OpenAlex API was queried to identify and rank active researchers based on publication count, citation impact, and recency within the specified time window.\n`;
    report += `4. **Human-in-the-Loop** — A checkpoint was presented for user review and approval before proceeding to expensive operations.\n`;
    report += `5. **Synthesis** — All collected data was synthesized into this structured report.\n\n`;
    report += `**Date range**: ${currentYear - 3} to ${currentYear}\n\n`;

    // ── Sources ──
    report += `## Sources & References\n\n`;
    let refIdx = 1;
    if (targets.length > 0) {
        report += `[${refIdx++}] BigQuery CIViC/PrimeKG datasets — disease-target associations\n`;
    }
    pubmedArticles.slice(0, 5).forEach((a: any) => {
        const authors = a.authors?.slice(0, 2).join(', ') || 'Unknown';
        report += `[${refIdx++}] ${authors} et al., "${a.title || 'Untitled'}", ${a.publicationDate || 'Unknown'}. PMID: ${a.pmid}\n`;
    });
    researchers.slice(0, 5).forEach((r: any) => {
        if (r.profileUrl) report += `[${refIdx++}] OpenAlex Author Profile: ${r.displayName} — ${r.profileUrl}\n`;
    });
    report += `\n`;

    // ── Next Steps ──
    report += `## Next-Step Suggestions\n\n`;
    report += `1. **Deep-dive into top targets** — Investigate the mechanism of action for the top-scoring gene targets (${targets.slice(0, 2).map((t: any) => t.targetSymbol).join(', ') || 'identified targets'}) using pathway analysis tools.\n`;
    report += `2. **Contact key researchers** — Reach out to the top-ranked researchers for potential collaboration, prioritizing those with "ACTIVE" activity levels and high h-index.\n`;
    report += `3. **Expand literature search** — Broaden the PubMed query to include related MeSH terms and clinical trial registrations (ClinicalTrials.gov) for upcoming therapeutic developments.\n`;

    return report;
}


export async function POST(req: Request) {
    logger.info(`\n${'═'.repeat(60)}`);
    logger.info(`${LOG} POST /api/agent/report - DeepResearch Synthesis`);
    try {
        const { sessionId } = await req.json();

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const session = await firestore_get_session(sessionId);
        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        logger.info(`${LOG} Synthesizing report for query: "${session.user_request}"`);

        // Build context from step results
        const agentContext = session.plan.map((step: any) => ({
            stepId: step.id,
            name: step.name,
            intent: step.intent,
            tools: step.tools,
            status: step.status,
            ai_analysis: step.result_data?.ai_analysis || null,
            data_counts: step.result_data?.data_counts || null,
            raw_data: step.result_data?.raw_data || null,
        }));

        const contextData = JSON.stringify({
            originalQuery: session.user_request,
            agentAnalyses: agentContext,
            gcsArtifacts: session.artifacts || {}
        }, null, 2);

        logger.info(`${LOG} Context size: ${contextData.length} characters`);

        let reportMarkdown: string;

        // Try Gemini first, fall back to comprehensive template
        try {
            const requestBody = {
                contents: [{
                    role: 'user',
                    parts: [
                        { text: `Generate the final research report based on this execution data:\n\n${contextData}` }
                    ]
                }],
                systemInstruction: { role: 'system' as const, parts: [{ text: REPORT_SYSTEM_INSTRUCTION }] }
            };

            logger.info(`${LOG} Calling Gemini 2.5 Flash for grounded synthesis...`);
            const response = await generativeModel.generateContent(requestBody);
            reportMarkdown = response.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

            if (!reportMarkdown || reportMarkdown.length < 100) {
                throw new Error('Empty or too short response from Gemini');
            }

            logger.info(`${LOG} ✅ Gemini report generated (${reportMarkdown.length} chars)`);
        } catch (primaryError: any) {
            logger.warn(`${LOG} ⚠️ Primary Gemini failed: ${primaryError.message}. Trying fallback model...`);

            try {
                const fallbackModel = vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
                const requestBody = {
                    contents: [{
                        role: 'user',
                        parts: [{ text: `Generate the final research report based on this execution data:\n\n${contextData}` }]
                    }],
                    systemInstruction: { role: 'system' as const, parts: [{ text: REPORT_SYSTEM_INSTRUCTION }] }
                };
                const fallbackResponse = await fallbackModel.generateContent(requestBody);
                reportMarkdown = fallbackResponse.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

                if (!reportMarkdown || reportMarkdown.length < 100) {
                    throw new Error('Empty fallback response');
                }
                logger.info(`${LOG} ✅ Fallback Gemini report generated (${reportMarkdown.length} chars)`);
            } catch (fallbackError: any) {
                logger.warn(`${LOG} ⚠️ All Gemini models unavailable: ${fallbackError.message}. Using template report.`);
                reportMarkdown = generateTemplateReport(session);
                logger.info(`${LOG} ✅ Template report generated (${reportMarkdown.length} chars)`);
            }
        }

        // Update session
        try {
            await firestore_upsert_session(sessionId, { final_output: reportMarkdown });
        } catch (e: any) {
            logger.warn(`${LOG} ⚠️ Session update failed (non-fatal): ${e.message}`);
        }

        logger.info(`${'═'.repeat(60)}\n`);

        return NextResponse.json({
            status: 'success',
            report: reportMarkdown
        });

    } catch (error: any) {
        logger.error({ err: error.message, stack: error.stack }, `${LOG} ❌ FATAL REPORT ERROR`);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
