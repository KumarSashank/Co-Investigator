'use client';

import { useState, useEffect } from 'react';

interface SessionSummary {
    session_id: string;
    user_request: string;
    preview: string;
    createdAt: string | null;
    updatedAt: string | null;
    hasReport: boolean;
}

interface SessionHistoryProps {
    currentSessionId?: string;
    onSessionSelect: (sessionId: string) => void;
    onNewSession: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export default function SessionHistory({
    currentSessionId,
    onSessionSelect,
    onNewSession,
    isCollapsed,
    onToggleCollapse,
}: SessionHistoryProps) {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch sessions on mount and when returning to sidebar
    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/agent/sessions?limit=30');
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
        setLoading(false);
    };

    // Group sessions by date
    const groupedSessions = groupByDate(sessions);

    if (isCollapsed) {
        return (
            <div
                className="w-12 shrink-0 flex flex-col items-center py-4 gap-3 cursor-pointer transition-all"
                style={{
                    borderRight: '1px solid var(--border-default)',
                    background: 'var(--bg-secondary)',
                }}
            >
                <button
                    onClick={onToggleCollapse}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hover:scale-110"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                    title="Expand sidebar"
                >
                    ☰
                </button>
                <button
                    onClick={onNewSession}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all hover:scale-110"
                    style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))', color: '#fff' }}
                    title="New Research"
                >
                    +
                </button>
                <div className="w-6 h-px my-1" style={{ background: 'var(--border-default)' }} />
                {sessions.slice(0, 5).map((s) => (
                    <button
                        key={s.session_id}
                        onClick={() => onSessionSelect(s.session_id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all hover:scale-110"
                        style={{
                            background: s.session_id === currentSessionId ? 'var(--accent-blue)' : 'var(--bg-card)',
                            color: s.session_id === currentSessionId ? '#fff' : 'var(--text-muted)',
                        }}
                        title={s.preview}
                    >
                        {s.hasReport ? '✓' : '◦'}
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div
            className="w-64 shrink-0 flex flex-col overflow-hidden transition-all"
            style={{
                borderRight: '1px solid var(--border-default)',
                background: 'var(--bg-secondary)',
            }}
        >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between shrink-0"
                style={{ borderBottom: '1px solid var(--border-default)' }}
            >
                <h3 className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    Research History
                </h3>
                <button
                    onClick={onToggleCollapse}
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px] transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                    title="Collapse sidebar"
                >
                    ◀
                </button>
            </div>

            {/* New Research Button */}
            <div className="px-3 py-2 shrink-0">
                <button
                    onClick={onNewSession}
                    className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
                        color: '#fff',
                    }}
                >
                    <span>+</span> New Research
                </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-2 py-1">
                {loading ? (
                    <div className="flex flex-col gap-2 px-2 py-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--bg-card)' }} />
                        ))}
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-8 px-3">
                        <div className="text-2xl opacity-30 mb-2">🔬</div>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            No research sessions yet.
                        </p>
                        <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                            Start your first investigation!
                        </p>
                    </div>
                ) : (
                    Object.entries(groupedSessions).map(([dateLabel, items]) => (
                        <div key={dateLabel} className="mb-3">
                            <p className="text-[9px] font-bold uppercase tracking-wider px-2 py-1.5"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                {dateLabel}
                            </p>
                            {items.map((s) => (
                                <button
                                    key={s.session_id}
                                    onClick={() => onSessionSelect(s.session_id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-all hover:scale-[1.01] group ${s.session_id === currentSessionId ? 'ring-1' : ''
                                        }`}
                                    style={{
                                        background: s.session_id === currentSessionId
                                            ? 'rgba(0, 122, 255, 0.1)'
                                            : 'transparent',
                                        borderColor: 'var(--accent-blue)',
                                    }}
                                >
                                    <div className="flex items-start gap-2">
                                        <span className="text-[10px] mt-0.5 shrink-0">
                                            {s.hasReport ? '✅' : '🔄'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[11px] font-medium leading-snug truncate"
                                                style={{
                                                    color: s.session_id === currentSessionId
                                                        ? 'var(--accent-blue)'
                                                        : 'var(--text-primary)',
                                                }}
                                            >
                                                {s.preview || 'Untitled Research'}
                                            </p>
                                            <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {formatTime(s.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* Refresh Button */}
            <div className="px-3 py-2 shrink-0" style={{ borderTop: '1px solid var(--border-default)' }}>
                <button
                    onClick={fetchSessions}
                    className="w-full py-1.5 rounded text-[10px] transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-muted)' }}
                >
                    ↻ Refresh
                </button>
            </div>
        </div>
    );
}

/* ---- Helpers ---- */

function groupByDate(sessions: SessionSummary[]): Record<string, SessionSummary[]> {
    const groups: Record<string, SessionSummary[]> = {};
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    for (const s of sessions) {
        let label = 'Older';
        if (s.createdAt) {
            const d = new Date(s.createdAt);
            const dStr = d.toDateString();
            if (dStr === today) label = 'Today';
            else if (dStr === yesterday) label = 'Yesterday';
            else {
                const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
                if (diffDays <= 7) label = 'This Week';
                else if (diffDays <= 30) label = 'This Month';
            }
        }
        if (!groups[label]) groups[label] = [];
        groups[label].push(s);
    }

    return groups;
}

function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
