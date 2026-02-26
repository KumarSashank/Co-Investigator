const https = require('https');

const pmid = '39051188'; // "Cystic Fibrosis: Understanding Cystic Fibrosis Transmembrane Regulator Mutation Classification and Modulator Therapies"

console.log(`Fetching PubTator data for PMID: ${pmid}...\n`);

const url = `https://www.ncbi.nlm.nih.gov/research/pubtator-api/publications/export/pubtator?pmids=${pmid}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log("========================================================");
        console.log(`✅ RAW PUBTATOR ANNOTATIONS FOR PMID ${pmid}`);
        console.log("========================================================\n");
        console.log(data);

        // Parse it nicely
        console.log("\n========================================================");
        console.log(`✅ PARSED ENTITIES`);
        console.log("========================================================\n");

        const lines = data.split('\n');
        let title = '', abstract = '';
        const entities = [];

        lines.forEach(line => {
            if (!line.trim()) return;
            if (line.includes('|t|')) {
                title = line.split('|t|')[1];
            } else if (line.includes('|a|')) {
                abstract = line.split('|a|')[1];
            } else {
                const parts = line.split('\t');
                if (parts.length >= 6) {
                    entities.push({
                        text: parts[3],
                        type: parts[4],
                        id: parts[5].trim()
                    });
                }
            }
        });

        console.log(`TITLE: ${title}`);
        console.log(`\nENTITIES FOUND: ${entities.length}`);

        // Group by type
        const byType = {};
        entities.forEach(e => {
            if (!byType[e.type]) byType[e.type] = new Set();
            byType[e.type].add(e.text + ' (' + e.id + ')');
        });

        Object.keys(byType).forEach(type => {
            console.log(`\n-- ${type} --`);
            byType[type].forEach(item => console.log(`  * ${item}`));
        });
        console.log("\n========================================================\n");
    });
}).on('error', (e) => {
    console.error(e);
});
