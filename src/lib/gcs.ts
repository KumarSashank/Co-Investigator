import { execSync } from 'child_process';
import { gunzipSync } from 'zlib';

const BUCKET = 'benchspark-data-1771447466-datasets';

// In-memory cache: file path → contents (loaded once from GCS per server restart)
const cache = new Map<string, string>();

/**
 * Gets a fresh access token from gcloud CLI.
 * This uses the gcloud auth (which has proper GCS access) instead of ADC (which gets 403).
 */
function getAccessToken(): string {
    try {
        return execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
    } catch {
        throw new Error('Failed to get gcloud access token. Run: gcloud auth login');
    }
}

/**
 * Downloads a file from GCS using the GCS JSON API + gcloud auth token.
 * Caches in memory (never writes to disk).
 */
export async function readGCSFile(filePath: string): Promise<string> {
    if (cache.has(filePath)) {
        return cache.get(filePath)!;
    }

    const token = getAccessToken();
    const encodedPath = encodeURIComponent(filePath);
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodedPath}?alt=media`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        throw new Error(`GCS download failed for ${filePath}: ${response.status} ${response.statusText}`);
    }

    // Handle gzipped files
    let content: string;
    if (filePath.endsWith('.gz')) {
        const buffer = Buffer.from(await response.arrayBuffer());
        content = gunzipSync(buffer).toString('utf-8');
    } else {
        content = await response.text();
    }

    cache.set(filePath, content);
    console.log(`[GCS] Loaded ${filePath} (${(content.length / 1024).toFixed(1)} KB) from cloud`);
    return content;
}

/**
 * Lists all objects under a given prefix in the GCS bucket.
 */
export async function listGCSFiles(prefix: string): Promise<string[]> {
    const token = getAccessToken();
    const url = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=${encodeURIComponent(prefix)}`;

    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        throw new Error(`GCS list failed for ${prefix}: ${response.status}`);
    }

    const data = await response.json();
    return (data.items || []).map((item: { name: string }) => item.name);
}

/**
 * Clears the in-memory cache (useful for refreshing data).
 */
export function clearGCSCache(): void {
    cache.clear();
    console.log('[GCS] Cache cleared');
}

/**
 * Returns the current cache stats.
 */
export function getGCSCacheStats(): { files: number; totalSizeKB: number } {
    let totalSize = 0;
    cache.forEach((content) => {
        totalSize += content.length;
    });
    return { files: cache.size, totalSizeKB: Math.round(totalSize / 1024) };
}
