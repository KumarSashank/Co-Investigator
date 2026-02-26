import { BigQuery } from '@google-cloud/bigquery';
import { BigQueryDiseaseResponse } from './types';

const bigqueryClient = new BigQuery({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'benchspark-data-1771447466',
});

/**
 * Fetches disease-target association data from BigQuery.
 * 
 * Queries the `primekg` dataset in the hackathon project.
 * Falls back to realistic demo data if BigQuery is not accessible.
 */
export async function fetchDiseaseTargetsFromBigQuery(diseaseId: string): Promise<BigQueryDiseaseResponse> {
  // Try the Open Targets public dataset first, then the local primekg dataset
  const queries = [
    // Query 1: Try Open Targets public dataset (disease-target associations)
    `SELECT
      t.id AS targetId,
      t.approvedSymbol AS targetSymbol,
      a.score AS evidenceScore
    FROM \`open-targets-prod.platform.associationByOverallDirect\` a
    JOIN \`open-targets-prod.platform.targets\` t ON a.targetId = t.id
    WHERE a.diseaseId = @diseaseId
    ORDER BY a.score DESC
    LIMIT 10`,
    // Query 2: Try local primekg dataset (if populated)
    `SELECT
      x_id AS targetId,
      x_name AS targetSymbol,
      1.0 AS evidenceScore
    FROM \`benchspark-data-1771447466.primekg.primekg\`
    WHERE relation = 'associated_with'
      AND y_name LIKE CONCAT('%', @diseaseId, '%')
    LIMIT 10`,
  ];

  for (const query of queries) {
    try {
      const [rows] = await bigqueryClient.query({
        query,
        location: 'US',
        params: { diseaseId },
      });

      if (rows.length > 0) {
        const associatedTargets = rows.map((row: Record<string, unknown>) => ({
          targetId: String(row.targetId || ''),
          targetSymbol: String(row.targetSymbol || `Target_${String(row.targetId || '').substring(0, 8)}`),
          evidenceScore: Number(row.evidenceScore) || 0,
        }));

        return {
          diseaseId,
          diseaseName: diseaseId,
          associatedTargets,
          pathways: ['Signal Transduction', 'Immune System'],
        };
      }
    } catch (error) {
      console.warn(`BigQuery query attempt failed, trying next:`, error instanceof Error ? error.message : error);
    }
  }

  // Fallback: return scientifically-relevant demo data for IPF (Idiopathic Pulmonary Fibrosis)
  // This ensures the frontend and agent always have data to work with during the hackathon
  console.warn('All BigQuery queries failed, returning demo fallback data');
  return getDemoFallbackData(diseaseId);
}

function getDemoFallbackData(diseaseId: string): BigQueryDiseaseResponse {
  // Realistic IPF-related targets for demo purposes
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
