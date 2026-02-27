'use client';

import { useState } from 'react';

interface Target {
    name: string;
    relevance: string;
    evidence_score: number;
    investigate_further: boolean;
}

interface TargetsPanelProps {
    targets: Target[];
    diseaseSummary?: string;
}

export default function TargetsPanel({ targets, diseaseSummary }: TargetsPanelProps) {
    const [selectedTarget, setSelectedTarget] = useState<Target | null>(null);
    const [sortBy, setSortBy] = useState<'score' | 'name'>('score');

    const sorted = [...targets].sort((a, b) => {
        if (sortBy === 'score') return (b.evidence_score || 0) - (a.evidence_score || 0);
        return (a.name || '').localeCompare(b.name || '');
    });

    return (
        <div className="h-full flex flex-col">
            {/* Summary */}
            {diseaseSummary && (
                <div className="px-5 py-3 bg-cyan-500/5 border-b border-[var(--border-default)]">
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">"{diseaseSummary}"</p>
                </div>
            )}

            {/* Controls */}
            <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)]">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{targets.length} targets identified</span>
                <div className="flex gap-1">
                    <button onClick={() => setSortBy('score')} className={`text-[9px] px-2 py-1 rounded ${sortBy === 'score' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[var(--text-muted)]'}`}>By Score</button>
                    <button onClick={() => setSortBy('name')} className={`text-[9px] px-2 py-1 rounded ${sortBy === 'name' ? 'bg-cyan-500/20 text-cyan-400' : 'text-[var(--text-muted)]'}`}>A-Z</button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
                        <tr className="border-b border-[var(--border-default)]">
                            <th className="text-left px-5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Target</th>
                            <th className="text-left px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Score</th>
                            <th className="text-left px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Priority</th>
                            <th className="text-right px-5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)]">
                        {sorted.map((t, i) => (
                            <tr
                                key={i}
                                className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                                onClick={() => setSelectedTarget(selectedTarget?.name === t.name ? null : t)}
                            >
                                <td className="px-5 py-3">
                                    <span className="font-semibold text-[var(--accent-cyan)]">{t.name}</span>
                                </td>
                                <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-12 h-1.5 bg-[var(--bg-input)] rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full" style={{ width: `${Math.min((t.evidence_score || 0) * 10, 100)}%` }} />
                                        </div>
                                        <span className="text-[var(--text-muted)] font-mono text-[10px]">{t.evidence_score || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-3">
                                    {t.investigate_further ? (
                                        <span className="text-[9px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold">HIGH</span>
                                    ) : (
                                        <span className="text-[9px] bg-gray-500/15 text-[var(--text-muted)] px-2 py-0.5 rounded-full font-bold">STD</span>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <span className="text-[var(--text-muted)] text-[10px]">{selectedTarget?.name === t.name ? '▴' : '▾'}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Expanded Detail Drawer */}
                {selectedTarget && (
                    <div className="mx-5 mb-4 p-4 bg-[var(--bg-input)] rounded-lg border border-cyan-500/20 animate-fade-in">
                        <h4 className="text-sm font-bold text-[var(--accent-cyan)] mb-2">{selectedTarget.name}</h4>
                        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{selectedTarget.relevance}</p>
                        <div className="mt-3 flex gap-3 text-[9px] font-mono text-[var(--text-muted)]">
                            <span>Evidence Score: {selectedTarget.evidence_score}</span>
                            <span>•</span>
                            <span>Investigate: {selectedTarget.investigate_further ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
