import { generateDynamicSQL } from './src/lib/vertex/sqlAgent';
import { executeDynamicQuery } from './src/lib/bigquery';
import * as fs from 'fs';

async function main() {
    console.log("Testing Dynamic SQL Generation...");
    const schemaDict = JSON.parse(fs.readFileSync('./src/lib/schema_context.json', 'utf8'));

    // 1. Test Disease Intent
    const diseaseSchema = schemaDict['open-targets-prod.platform.disease'];
    const sql1 = await generateDynamicSQL(
        'open-targets-prod.platform.disease',
        diseaseSchema,
        "Find the disease ID for Idiopathic Pulmonary Fibrosis",
        "Find the disease ID for Idiopathic Pulmonary Fibrosis"
    );
    console.log("\nExec SQL 1...");
    const res1 = await executeDynamicQuery(sql1, 'disease');
    console.log(`Rows returned: ${res1.rowCount}`);
    console.log(res1.rows[0]);

    // 2. Test Drug Pipeline Intent
    const drugSchema = schemaDict['open-targets-prod.platform.known_drug'];
    const sql2 = await generateDynamicSQL(
        'open-targets-prod.platform.known_drug',
        drugSchema,
        "Find all Phase 4 approved drugs for disease EFO_0000768",
        "What are the approved treatments for Idiopathic Pulmonary Fibrosis?"
    );
    console.log("\nExec SQL 2...");
    const res2 = await executeDynamicQuery(sql2, 'known_drug');
    console.log(`Rows returned: ${res2.rowCount}`);
    console.log(res2.rows[0]);
}

main().catch(console.error);
