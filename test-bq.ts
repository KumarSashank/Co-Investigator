import { fetchDiseaseTargetsFromBigQuery } from './src/lib/bigquery';

async function main() {
    console.log("Testing BigQuery Resolution...");
    const res = await fetchDiseaseTargetsFromBigQuery("Idiopathic Pulmonary Fibrosis");
    console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);
