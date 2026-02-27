import { fetchDiseaseTargetsFromBigQuery } from './src/lib/bigquery';
fetchDiseaseTargetsFromBigQuery("BCL11A").then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
