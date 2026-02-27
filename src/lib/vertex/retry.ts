import { logger } from '@/lib/logger';

export async function withVertexRetry<T>(
    operationName: string,
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 2000
): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await operation();
        } catch (error: any) {
            attempt++;
            const errStr = String(error?.message || error?.status || error);
            const isRateLimit = errStr.includes('429') ||
                errStr.includes('Too Many Requests') ||
                errStr.includes('Resource exhausted') ||
                errStr.includes('RESOURCE_EXHAUSTED');

            if (!isRateLimit || attempt >= maxRetries) {
                if (attempt >= maxRetries && isRateLimit) {
                    const msg = `[Retry] ❌ Max retries (${maxRetries}) reached for ${operationName} due to rate limits.`;
                    if (logger && logger.error) {
                        logger.error(msg);
                    } else {
                        console.error(msg);
                    }
                }
                throw error;
            }

            const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000;
            const msg = `[Retry] ⚠️ API rate limit hit (429) for ${operationName}. Retrying in ${Math.round(delay)}ms... (Attempt ${attempt} of ${maxRetries})`;

            if (logger && logger.warn) {
                logger.warn(msg);
            } else {
                console.warn(msg);
            }

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw new Error('Max retries reached');
}
