import { Storage } from '@google-cloud/storage';

const storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986'
});

const BUCKET_NAME = `benchspark-artifacts-${process.env.GOOGLE_CLOUD_PROJECT || 'lazy-coders-1771991986'}`;

/**
 * Ensures the artifact bucket exists, creating it if necessary.
 */
async function ensureBucketExists() {
    try {
        const bucket = storage.bucket(BUCKET_NAME);
        const [exists] = await bucket.exists();
        if (!exists) {
            console.log(`[GCS] Creating artifact bucket: ${BUCKET_NAME}`);
            await storage.createBucket(BUCKET_NAME, {
                location: 'US',
                storageClass: 'STANDARD',
            });
            console.log(`[GCS] Bucket created successfully.`);
        }
        return bucket;
    } catch (error) {
        console.error(`[GCS] Error ensuring bucket exists:`, error);
        throw error;
    }
}

/**
 * Writes content (string or JSON) to Google Cloud Storage.
 * Follows the DeepResearch requirement: gcs_write(path, content_json_or_text) -> returns gs:// path
 * 
 * @param path The relative path inside the bucket (e.g. 'runs/session-123/step-1.json')
 * @param content The content to write (object will be stringified)
 * @returns The exact gs:// URI of the written file
 */
export async function gcs_write(path: string, content: any): Promise<string> {
    try {
        const bucket = await ensureBucketExists();
        const file = bucket.file(path);

        let fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

        await file.save(fileContent, {
            contentType: path.endsWith('.json') ? 'application/json' : 'text/plain',
            resumable: false
        });

        const gsUri = `gs://${BUCKET_NAME}/${path}`;
        console.log(`[GCS] ✅ Wrote artifact to ${gsUri}`);

        return gsUri;
    } catch (error) {
        console.error(`[GCS] ❌ Failed to write artifact to ${path}:`, error);
        throw new Error(`Failed to write to GCS: ${error instanceof Error ? error.message : String(error)}`);
    }
}
