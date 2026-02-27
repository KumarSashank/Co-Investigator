import { NextResponse } from 'next/server';
import { readGCSFile } from '@/lib/gcs';

// Temporary debug endpoint — inspects raw ClinGen CSV parsing
export async function GET() {
    try {
        const csv = await readGCSFile('clingen/gene-disease-validity.csv');
        const allLines = csv.replace(/\r/g, '').split('\n');

        // Find header row dynamically
        let headerIdx = -1;
        for (let i = 0; i < allLines.length && i < 20; i++) {
            const upper = allLines[i].toUpperCase();
            if (upper.includes('GENE SYMBOL') || upper.includes('HGNC ID') || upper.includes('DISEASE LABEL')) {
                headerIdx = i;
                break;
            }
        }

        // Parse 3 data rows directly to check column values
        const dataRows = allLines.slice(headerIdx + 1).filter(r => r.trim()).slice(0, 3);

        const parsedRows = dataRows.map(row => {
            const fields: string[] = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < row.length; i++) {
                const char = row[i];
                if (char === '"') { inQuotes = !inQuotes; }
                else if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
                else { current += char; }
            }
            fields.push(current.trim());
            return {
                raw: row.substring(0, 200),
                col0_geneSymbol: fields[0],
                col1_hgncId: fields[1],
                col2_diseaseLabel: fields[2],
                col3_diseaseMim: fields[3],
                col6_classification: fields[6],
                totalCols: fields.length
            };
        });

        // Search for heart rows directly
        const heartRows = allLines.slice(headerIdx + 1).filter(r =>
            r.toLowerCase().includes('myocardial') ||
            r.toLowerCase().includes('cardiac') ||
            r.toLowerCase().includes('heart')
        ).slice(0, 2);

        return NextResponse.json({
            totalRawLines: allLines.length,
            headerRowIndex: headerIdx,
            headerRowContent: allLines[headerIdx],
            parsedSampleRows: parsedRows,
            heartRelatedRawLines: heartRows,
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
