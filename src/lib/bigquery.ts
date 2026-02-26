import { BigQuery } from '@google-cloud/bigquery';
import { BigQueryDiseaseResponse } from './types';

const LOG_PREFIX = '🗄️ [BigQuery]';

const bigqueryClient = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
});

/**
 * Fetches disease-target association data from BigQuery.
 */
export async function fetchDiseaseTargetsFromBigQuery(diseaseId: string): Promise<BigQueryDiseaseResponse> {
  console.log(`${LOG_PREFIX} Querying for disease: "${diseaseId}"`);
  console.log(`${LOG_PREFIX} Using project: ${process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466'}`);

  const queries = [
    {
      name: 'Open Targets public dataset',
      sql: `SELECT
        t.id AS targetId,
        t.approvedSymbol AS targetSymbol,
        a.score AS evidenceScore
      FROM \`open-targets-prod.platform.associationByOverallDirect\` a
      JOIN \`open-targets-prod.platform.targets\` t ON a.targetId = t.id
      WHERE a.diseaseId = @diseaseId
      ORDER BY a.score DESC
      LIMIT 10`
    },
    {
      name: 'Local PrimeKG dataset',
      sql: `SELECT
        x_id AS targetId,
        x_name AS targetSymbol,
        1.0 AS evidenceScore
      FROM \`benchspark-data-1771447466.primekg.primekg\`
      WHERE relation = 'associated_with'
        AND y_name LIKE CONCAT('%', @diseaseId, '%')
      LIMIT 10`
    },
  ];

  for (const { name, sql } of queries) {
    try {
      console.log(`${LOG_PREFIX} Trying query: ${name}...`);
      const [rows] = await bigqueryClient.query({
        query: sql,
        location: 'US',
        params: { diseaseId },
      });

      console.log(`${LOG_PREFIX} ${name} returned ${rows.length} rows`);

      if (rows.length > 0) {
        const associatedTargets = rows.map((row: Record<string, unknown>) => ({
          targetId: String(row.targetId || ''),
          targetSymbol: String(row.targetSymbol || `Target_${String(row.targetId || '').substring(0, 8)}`),
          evidenceScore: Number(row.evidenceScore) || 0,
        }));

        console.log(`${LOG_PREFIX} ✅ Found ${associatedTargets.length} targets from ${name}`);
        associatedTargets.forEach((t, i) => {
          console.log(`${LOG_PREFIX}    ${i + 1}. ${t.targetSymbol} (score: ${t.evidenceScore})`);
        });

        return {
          diseaseId,
          diseaseName: diseaseId,
          associatedTargets,
          pathways: ['Signal Transduction', 'Immune System'],
        };
      }
    } catch (error) {
      console.warn(`${LOG_PREFIX} ⚠️ ${name} failed:`, error instanceof Error ? error.message : error);
    }
  }

  console.warn(`${LOG_PREFIX} ⚠️ All BigQuery queries failed — returning FALLBACK demo data`);
  return getDemoFallbackData(diseaseId);
}

function getDemoFallbackData(diseaseId: string): BigQueryDiseaseResponse {
  const ipfTargets = [
    { targetId: 'ENSG00000163735', targetSymbol: 'CXCL5', evidenceScore: 0.92 },
    { targetId: 'ENSG00000163734', targetSymbol: 'CXCL6', evidenceScore: 0.88 },
    { targetId: 'ENSG00000120738', targetSymbol: 'EGR1', evidenceScore: 0.85 },
    { targetId: 'ENSG00000100030', targetSymbol: 'MAPK1', evidenceScore: 0.82 },
    { targetId: 'ENSG00000105329', targetSymbol: 'TGFB1', evidenceScore: 0.79 },
    { targetId: 'ENSG00000157764', targetSymbol: 'BRAF', evidenceScore: 0.75 },
    { targetId: 'ENSG00000141510', targetSymbol: 'TP53', evidenceScore: 0.71 },
    { targetId: 'ENSG00000170345', targetSymbol: 'FOS', evidenceScore: 0.68 },
  ];

  console.log(`${LOG_PREFIX}    Fallback targets: ${ipfTargets.map(t => t.targetSymbol).join(', ')}`);

  return {
    diseaseId,
    diseaseName: diseaseId.includes('EFO') ? 'Idiopathic Pulmonary Fibrosis' : `Disease (${diseaseId})`,
    associatedTargets: ipfTargets,
    pathways: [
      'TGF-beta signaling pathway',
      'MAPK signaling pathway',
      'Wnt signaling pathway',
      'PI3K-Akt signaling pathway',
    ],
  };
}
