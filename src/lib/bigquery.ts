import { BigQuery } from '@google-cloud/bigquery';
import { logger } from './logger';

/**
 * BigQuery Intelligence Engine
 * 
 * Runs multiple parallel queries against Open Targets Platform to extract
 * deep patterns that would take researchers hours or days to find manually.
 * 
 * Query modules:
 *   1. Disease Resolution  — name → EFO/MONDO ID
 *   2. Target Association  — top gene targets with evidence scores
 *   3. Drug Pipeline       — approved/trial drugs, mechanisms of action
 *   4. Target Druggability — safety, pockets, small molecule binders
 *   5. Evidence Landscape  — evidence types and data source breakdown
 */

const LOG = '🗄️ [BigQuery]';

const bigqueryClient = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986',
});

// ---- Exported Response Type ----

export interface DiseaseTarget {
  targetId: string;
  targetSymbol: string;
  targetName: string;
  evidenceScore: number;
}

export interface DrugCandidate {
  drugId: string;
  drugName: string;
  targetSymbol: string;
  mechanismOfAction: string;
  phase: number;
  status: string | null;
}

export interface TargetDruggability {
  targetId: string;
  targetSymbol: string;
  isInMembrane: boolean;
  hasPocket: boolean;
  hasSmallMoleculeBinder: boolean;
  hasSafetyEvent: boolean;
  maxClinicalTrialPhase: number;
  geneticConstraint: number | null;
}

export interface DataQuality {
  source: 'BigQuery-OpenTargets' | 'BigQuery-PrimeKG' | 'NONE';
  isLiveData: boolean;
  note: string;
  queriedAt: string;
}

export interface BigQueryIntelligenceResponse {
  diseaseId: string;
  diseaseName: string;
  resolvedFromName: boolean;

  // Module outputs
  associatedTargets: DiseaseTarget[];
  drugPipeline: DrugCandidate[];
  targetDruggability: TargetDruggability[];
  evidenceSummary: Record<string, number>;
  pathways: string[];

  // Meta
  dataQuality: DataQuality;
  queryStats: {
    totalQueries: number;
    successfulQueries: number;
    totalTimeMs: number;
  };
}

// ---- Disease Name → EFO ID Resolution ----

async function resolveDiseaseId(diseaseInput: string): Promise<{ id: string; name: string } | null> {
  // If it's already an EFO/MONDO ID, look it up directly
  if (/^(EFO_|MONDO_|Orphanet_|DOID_|HP_)/i.test(diseaseInput)) {
    try {
      const [rows] = await bigqueryClient.query({
        query: `SELECT id, name FROM \`open-targets-prod.platform.disease\` WHERE id = @id`,
        params: { id: diseaseInput },
      });
      if (rows.length > 0) return { id: rows[0].id, name: rows[0].name };
    } catch (e: any) {
      logger.warn(`${LOG} Direct ID lookup failed: ${e.message}`);
    }
  }

  // Fuzzy name search
  const searchTerms = diseaseInput
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  // Build a flexible search: try exact match first, then fuzzy
  try {
    const [rows] = await bigqueryClient.query({
      query: `
                SELECT id, name,
                    CASE
                        WHEN LOWER(name) = @exactName THEN 100
                        WHEN LOWER(name) LIKE CONCAT('%', @searchTerm, '%') THEN 50
                        ELSE 10
                    END AS relevance
                FROM \`open-targets-prod.platform.disease\`
                WHERE LOWER(name) LIKE CONCAT('%', @searchTerm, '%')
                ORDER BY relevance DESC, LENGTH(name) ASC
                LIMIT 5
            `,
      params: {
        exactName: searchTerms,
        searchTerm: searchTerms,
      },
    });

    if (rows.length > 0) {
      logger.info(`${LOG} Resolved "${diseaseInput}" → ${rows[0].id} (${rows[0].name})`);
      return { id: rows[0].id, name: rows[0].name };
    }

    // Try splitting into keywords if full phrase fails
    const keywords = searchTerms.split(/\s+/).filter(w => w.length > 3);
    if (keywords.length >= 2) {
      const likeClause = keywords.map((_, i) => `LOWER(name) LIKE CONCAT('%', @kw${i}, '%')`).join(' AND ');
      const params: Record<string, string> = {};
      keywords.forEach((kw, i) => { params[`kw${i}`] = kw; });

      const [rows2] = await bigqueryClient.query({
        query: `SELECT id, name FROM \`open-targets-prod.platform.disease\` WHERE ${likeClause} ORDER BY LENGTH(name) ASC LIMIT 3`,
        params,
      });

      if (rows2.length > 0) {
        logger.info(`${LOG} Keyword-resolved "${diseaseInput}" → ${rows2[0].id} (${rows2[0].name})`);
        return { id: rows2[0].id, name: rows2[0].name };
      }
    }
  } catch (e: any) {
    logger.error(`${LOG} Disease resolution failed: ${e.message}`);
  }

  return null;
}

// ---- Module 1: Top Associated Targets ----

async function queryTopTargets(diseaseId: string): Promise<DiseaseTarget[]> {
  try {
    const [rows] = await bigqueryClient.query({
      query: `
                SELECT a.targetId, t.approvedSymbol, t.approvedName, a.score
                FROM \`open-targets-prod.platform.association_overall_direct\` a
                JOIN \`open-targets-prod.platform.target\` t ON a.targetId = t.id
                WHERE a.diseaseId = @diseaseId
                ORDER BY a.score DESC
                LIMIT 20
            `,
      params: { diseaseId },
    });

    return rows.map((r: any) => ({
      targetId: r.targetId,
      targetSymbol: r.approvedSymbol || 'Unknown',
      targetName: r.approvedName || '',
      evidenceScore: Number(r.score) || 0,
    }));
  } catch (e: any) {
    logger.error(`${LOG} Target query failed: ${e.message}`);
    return [];
  }
}

// ---- Module 2: Drug Pipeline ----

async function queryDrugPipeline(diseaseId: string): Promise<DrugCandidate[]> {
  try {
    const [rows] = await bigqueryClient.query({
      query: `
                SELECT DISTINCT
                    drugId, prefName, approvedSymbol,
                    mechanismOfAction, phase, status
                FROM \`open-targets-prod.platform.known_drug\`
                WHERE diseaseId = @diseaseId
                ORDER BY phase DESC, prefName
                LIMIT 25
            `,
      params: { diseaseId },
    });

    return rows.map((r: any) => ({
      drugId: r.drugId || '',
      drugName: r.prefName || 'Unknown',
      targetSymbol: r.approvedSymbol || '',
      mechanismOfAction: r.mechanismOfAction || '',
      phase: Number(r.phase) || 0,
      status: r.status || null,
    }));
  } catch (e: any) {
    logger.error(`${LOG} Drug pipeline query failed: ${e.message}`);
    return [];
  }
}

// ---- Module 3: Target Druggability / Safety ----

async function queryTargetDruggability(targetIds: string[]): Promise<TargetDruggability[]> {
  if (targetIds.length === 0) return [];

  try {
    // BigQuery doesn't support parameterized arrays easily, build IN clause safely
    const placeholders = targetIds.map((_, i) => `@t${i}`).join(', ');
    const params: Record<string, string> = {};
    targetIds.forEach((id, i) => { params[`t${i}`] = id; });

    const [rows] = await bigqueryClient.query({
      query: `
                SELECT tp.targetId, t.approvedSymbol,
                    tp.isInMembrane, tp.hasPocket, tp.hasSmallMoleculeBinder,
                    tp.hasSafetyEvent, tp.maxClinicalTrialPhase, tp.geneticConstraint
                FROM \`open-targets-prod.platform.target_prioritisation\` tp
                JOIN \`open-targets-prod.platform.target\` t ON tp.targetId = t.id
                WHERE tp.targetId IN (${placeholders})
            `,
      params,
    });

    return rows.map((r: any) => ({
      targetId: r.targetId,
      targetSymbol: r.approvedSymbol || '',
      isInMembrane: !!r.isInMembrane,
      hasPocket: !!r.hasPocket,
      hasSmallMoleculeBinder: !!r.hasSmallMoleculeBinder,
      hasSafetyEvent: !!r.hasSafetyEvent,
      maxClinicalTrialPhase: Number(r.maxClinicalTrialPhase) || 0,
      geneticConstraint: r.geneticConstraint != null ? Number(r.geneticConstraint) : null,
    }));
  } catch (e: any) {
    logger.error(`${LOG} Druggability query failed: ${e.message}`);
    return [];
  }
}

// ---- Module 4: Evidence Landscape ----

async function queryEvidenceSummary(diseaseId: string): Promise<Record<string, number>> {
  try {
    const [rows] = await bigqueryClient.query({
      query: `
                SELECT datasourceId, SUM(score) AS totalScore, COUNT(*) AS evidenceCount
                FROM \`open-targets-prod.platform.association_by_datasource_direct\`
                WHERE diseaseId = @diseaseId
                GROUP BY datasourceId
                ORDER BY totalScore DESC
                LIMIT 15
            `,
      params: { diseaseId },
    });

    const summary: Record<string, number> = {};
    rows.forEach((r: any) => {
      summary[r.datasourceId] = Number(r.evidenceCount) || 0;
    });
    return summary;
  } catch (e: any) {
    logger.error(`${LOG} Evidence summary query failed: ${e.message}`);
    return {};
  }
}

// ---- Main: Run All Modules in Parallel ----

export async function fetchDiseaseTargetsFromBigQuery(diseaseInput: string): Promise<BigQueryIntelligenceResponse> {
  const startTime = Date.now();
  let successCount = 0;

  logger.info(`${LOG} 🚀 Starting intelligence query for: "${diseaseInput}"`);

  // Step 1: Resolve disease name → ID
  const resolved = await resolveDiseaseId(diseaseInput);

  if (!resolved) {
    logger.warn(`${LOG} ⚠️ Could not resolve disease: "${diseaseInput}". Returning empty result.`);
    return {
      diseaseId: diseaseInput,
      diseaseName: diseaseInput,
      resolvedFromName: false,
      associatedTargets: [],
      drugPipeline: [],
      targetDruggability: [],
      evidenceSummary: {},
      pathways: [],
      dataQuality: {
        source: 'NONE',
        isLiveData: false,
        note: `Disease "${diseaseInput}" could not be resolved in Open Targets. No data returned.`,
        queriedAt: new Date().toISOString(),
      },
      queryStats: { totalQueries: 1, successfulQueries: 0, totalTimeMs: Date.now() - startTime },
    };
  }

  const { id: diseaseId, name: diseaseName } = resolved;
  successCount++;
  logger.info(`${LOG} ✅ Disease resolved: ${diseaseId} (${diseaseName})`);

  // Step 2: Run modules in parallel
  const [targets, drugs, evidence] = await Promise.all([
    queryTopTargets(diseaseId),
    queryDrugPipeline(diseaseId),
    queryEvidenceSummary(diseaseId),
  ]);

  successCount += (targets.length > 0 ? 1 : 0) + (drugs.length > 0 ? 1 : 0) + (Object.keys(evidence).length > 0 ? 1 : 0);

  // Step 3: Druggability for top targets (depends on Step 2)
  const topTargetIds = targets.slice(0, 10).map(t => t.targetId);
  const druggability = await queryTargetDruggability(topTargetIds);
  if (druggability.length > 0) successCount++;

  // Step 4: Extract unique pathways from drug mechanisms
  const pathways = [...new Set(drugs.map(d => d.mechanismOfAction).filter(Boolean))];

  const totalTimeMs = Date.now() - startTime;

  logger.info(`${LOG} ✅ Intelligence complete in ${totalTimeMs}ms`);
  logger.info(`${LOG}    📊 ${targets.length} targets, ${drugs.length} drugs, ${druggability.length} druggability profiles`);
  logger.info(`${LOG}    📊 ${Object.keys(evidence).length} evidence sources, ${pathways.length} mechanisms`);

  // Log the key findings
  if (targets.length > 0) {
    logger.info(`${LOG}    🎯 Top targets: ${targets.slice(0, 5).map(t => `${t.targetSymbol}(${t.evidenceScore.toFixed(2)})`).join(', ')}`);
  }
  if (drugs.length > 0) {
    const approved = drugs.filter(d => d.phase >= 4);
    const inTrial = drugs.filter(d => d.phase >= 2 && d.phase < 4);
    logger.info(`${LOG}    💊 Drugs: ${approved.length} approved, ${inTrial.length} in trials (Phase 2+)`);
  }

  const hasRealData = targets.length > 0 || drugs.length > 0;

  return {
    diseaseId,
    diseaseName,
    resolvedFromName: diseaseInput !== diseaseId,
    associatedTargets: targets,
    drugPipeline: drugs,
    targetDruggability: druggability,
    evidenceSummary: evidence,
    pathways,
    dataQuality: {
      source: hasRealData ? 'BigQuery-OpenTargets' : 'NONE',
      isLiveData: hasRealData,
      note: hasRealData
        ? `Live data from Open Targets Platform (${targets.length} targets, ${drugs.length} drugs)`
        : `No results found for ${diseaseName} in BigQuery. Queries ran but returned empty.`,
      queriedAt: new Date().toISOString(),
    },
    queryStats: {
      totalQueries: 5,
      successfulQueries: successCount,
      totalTimeMs,
    },
  };
}
