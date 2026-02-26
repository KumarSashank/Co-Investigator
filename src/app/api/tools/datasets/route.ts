import { NextResponse } from 'next/server';
import { DATASETS, listDatasetFiles, readDatasetFile, getCacheStats } from '@/lib/cloudData';

/**
 * GET /api/tools/datasets
 *
 * Lists all available cloud datasets or retrieves data from a specific dataset.
 *
 * Query params:
 *   - (none): Returns the list of all 15 datasets with metadata
 *   - dataset=<path>: Lists files in that dataset folder
 *   - file=<path>: Returns the contents of a specific file (first 10000 chars)
 *   - stats: Returns cache statistics
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const dataset = searchParams.get('dataset');
        const file = searchParams.get('file');
        const stats = searchParams.get('stats');

        // Return cache stats
        if (stats !== null) {
            return NextResponse.json({ cache: getCacheStats(), datasetsAvailable: DATASETS.length });
        }

        // Read a specific file from cloud
        if (file) {
            const content = await readDatasetFile(file);
            // Return first 10000 chars to avoid huge responses
            const preview = content.length > 10000 ? content.substring(0, 10000) + '\n... (truncated)' : content;
            return NextResponse.json({
                file,
                size: content.length,
                preview,
            });
        }

        // List files in a dataset folder
        if (dataset) {
            const files = await listDatasetFiles(dataset);
            return NextResponse.json({
                dataset,
                fileCount: files.length,
                files,
            });
        }

        // Default: return all dataset metadata
        return NextResponse.json({
            bucket: 'gs://benchspark-data-1771447466-datasets',
            totalDatasets: DATASETS.length,
            datasets: DATASETS,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Datasets API] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
