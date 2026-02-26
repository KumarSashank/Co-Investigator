/**
 * Structured Logger for Co-Investigator Backend
 * 
 * Uses console.log/warn/error directly to avoid Next.js bundling issues
 * with pino's worker_threads transport. All output goes to the terminal.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel];
}

function formatMsg(level: string, context: any, msg?: string): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level.toUpperCase()}`;
    if (typeof context === 'string') {
        return `${prefix} ${context}`;
    }
    if (msg) {
        const ctxStr = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
        return `${prefix} ${msg}${ctxStr}`;
    }
    return `${prefix} ${JSON.stringify(context)}`;
}

export const logger = {
    debug(contextOrMsg: any, msg?: string) {
        if (!shouldLog('debug')) return;
        console.log(formatMsg('DEBUG', contextOrMsg, msg));
    },
    info(contextOrMsg: any, msg?: string) {
        if (!shouldLog('info')) return;
        console.log(formatMsg('INFO', contextOrMsg, msg));
    },
    warn(contextOrMsg: any, msg?: string) {
        if (!shouldLog('warn')) return;
        console.warn(formatMsg('WARN', contextOrMsg, msg));
    },
    error(contextOrMsg: any, msg?: string) {
        if (!shouldLog('error')) return;
        console.error(formatMsg('ERROR', contextOrMsg, msg));
    },
};
