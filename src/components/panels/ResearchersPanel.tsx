'use client';

import { useState } from 'react';

interface Researcher {
    name: string;
    institution?: string;
    relevance_score?: number;
    justification?: string;
    active?: boolean;
    key_topic_overlap?: string[];
    // from verify agent
    status?: string; // ACTIVE | DECLINING | RISING_STAR | SHIFTED_TOPIC
    last_relevant_pub_year?: number;
    recent_relevant_count?: number;
    notes?: string;
}

interface ResearchersPanelProps {
    researchers: Researcher[];
    topPicks?: string[];
    fieldTrend?: string;
}

const STATUS_BADGES: Record<string, { label: string, color: string, bg: string }> = {
    'ACTIVE': { label: 'Active', color: 'var(--accent-green)', bg: 'rgba(52,211,153,0.15)' },
    'RISING_STAR': { label: 'Rising Star', color: 'var(--accent-amber)', bg: 'rgba(251,191,36,0.15)' },
    'DECLINING': { label: 'Declining', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.15)' },
    'SHIFTED_TOPIC': { label: 'Shifted', color: 'var(--accent-red)', bg: 'rgba(248,113,113,0.15)' },
};

export default function ResearchersPanel({ researchers, topPicks, fieldTrend }: ResearchersPanelProps) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    return (
        <div className="h-full flex flex-col">
            {/* Field Trend */}
            {fieldTrend && (
                <div className="px-5 py-3 bg-amber-500/5 border-b border-[var(--border-default)]">
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">📊 {fieldTrend}</p>
                </div>
            )}

            {/* Top Picks */}
            {topPicks && topPicks.length > 0 && (
                <div className="px-5 py-2.5 border-b border-[var(--border-default)] flex items-center gap-2 bg-[var(--bg-secondary)]">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Top Picks:</span>
                    {topPicks.map((name, i) => (
                        <span key={i} className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-semibold">{name}</span>
                    ))}
                </div>
            )}

            {/* Researcher List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-default)]">
                {researchers.map((r, i) => {
                    const isSelected = selectedIdx === i;
                    const statusKey = r.status || (r.active ? 'ACTIVE' : 'DECLINING');
                    const badge = STATUS_BADGES[statusKey] || STATUS_BADGES['ACTIVE'];
                    const isTopPick = topPicks?.includes(r.name);

                    return (
                        <div key={i}>
                            <div
                                className={`px-5 py-3.5 flex items-start gap-4 cursor-pointer transition-colors ${isSelected ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                                onClick={() => setSelectedIdx(isSelected ? null : i)}
                            >
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-full bg-[var(--bg-input)] border border-[var(--border-default)] flex items-center justify-center text-[10px] font-bold text-[var(--accent-blue)] shrink-0 mt-0.5">
                                    {r.name?.charAt(0) || '?'}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-[var(--text-primary)]">{r.name}</span>
                                        {isTopPick && <span className="text-[8px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-bold">⭐ TOP PICK</span>}
                                    </div>
                                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{r.institution || 'Institution not available'}</p>
                                    {r.key_topic_overlap && r.key_topic_overlap.length > 0 && (
                                        <div className="flex gap-1 mt-1.5 flex-wrap">
                                            {r.key_topic_overlap.slice(0, 3).map((topic, j) => (
                                                <span key={j} className="text-[8px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">{topic}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Score + Badge */}
                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: badge.color, background: badge.bg }}>
                                        {badge.label}
                                    </span>
                                    {r.relevance_score !== undefined && (
                                        <span className="text-[10px] font-mono text-[var(--text-muted)]">Score: {r.relevance_score}</span>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {isSelected && (
                                <div className="px-5 pb-4 pt-1 bg-[var(--bg-input)] border-t border-[var(--border-default)] animate-fade-in">
                                    <div className="ml-12 space-y-2">
                                        {r.justification && (
                                            <div>
                                                <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Relevance Justification</p>
                                                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{r.justification}</p>
                                            </div>
                                        )}
                                        {r.notes && (
                                            <div>
                                                <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Notes</p>
                                                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{r.notes}</p>
                                            </div>
                                        )}
                                        <div className="flex gap-4 text-[9px] font-mono text-[var(--text-muted)] pt-1">
                                            {r.last_relevant_pub_year && <span>Last Pub: {r.last_relevant_pub_year}</span>}
                                            {r.recent_relevant_count !== undefined && <span>Recent Papers: {r.recent_relevant_count}</span>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
