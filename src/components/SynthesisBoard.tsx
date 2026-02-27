'use client';

import { useState } from 'react';
import { DeepResearchPlan, PinnedItem } from '@/types';

interface SynthesisBoardProps {
    session: DeepResearchPlan | null;
    pinnedItems: PinnedItem[];
    onUnpin: (id: string) => void;
    onGenerateReport: () => void;
}

export default function SynthesisBoard({ session, pinnedItems, onUnpin, onGenerateReport }: SynthesisBoardProps) {
    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-secondary)] relative overflow-hidden">
                {/* Decorative background grid */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

                <div className="text-5xl mb-6 opacity-20">📌</div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2 tracking-wide">Synthesis Board</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-sm leading-relaxed">
                    Your pristine curation canvas. Start an investigation in the feed, then pin the specific evidence you want to synthesize into your final protocol.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] relative">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)] shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <span className="text-lg">📋</span>
                    <div>
                        <h2 className="text-sm font-bold text-[var(--accent-cyan)]">{session.user_request.substring(0, 40)}{session.user_request.length > 40 ? '...' : ''}</h2>
                        <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-2">
                            <span>{pinnedItems.length} Pinned Items</span>
                            {pinnedItems.length > 0 && (
                                <span className="bg-[var(--accent-amber-glow)] text-[var(--accent-amber)] px-1.5 py-0.5 rounded font-mono text-[8px]">ACTIVE CURATION</span>
                            )}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onGenerateReport}
                    disabled={pinnedItems.length === 0}
                    className="bg-green-600 hover:bg-green-500 disabled:opacity-30 disabled:hover:bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-[0_0_15px_rgba(22,163,74,0.3)] disabled:shadow-none flex items-center gap-2"
                >
                    <span>📝</span> Generate Targeted Report
                </button>
            </div>

            {/* Board Canvas */}
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-card)]">
                {pinnedItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-[var(--border-default)] rounded-xl m-8">
                        <span className="text-3xl mb-3">📍</span>
                        <p className="text-xs text-[var(--text-primary)]">Board is empty.</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1 text-center max-w-xs">As the agent discovers targets, KOLs, and literature in the feed, click "+ PIN" to add them here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
                        {pinnedItems.map((item, idx) => (
                            <PinnedCard key={item.id} item={item} onUnpin={onUnpin} index={idx} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function PinnedCard({ item, onUnpin, index }: { item: PinnedItem, onUnpin: (id: string) => void, index: number }) {

    // Determine card aesthetics based on type
    let icon = '📌';
    let colorClass = 'border-[var(--border-default)]';
    let headerBg = 'bg-[var(--bg-secondary)]';

    if (item.type === 'target') {
        icon = '🎯';
        colorClass = 'border-cyan-500/30';
        headerBg = 'bg-cyan-500/10';
    } else if (item.type === 'researcher') {
        icon = '👥';
        colorClass = 'border-amber-500/30';
        headerBg = 'bg-amber-500/10';
    } else if (item.type === 'paper') {
        icon = '📑';
        colorClass = 'border-blue-500/30';
        headerBg = 'bg-blue-500/10';
    }

    return (
        <div className={`glass-card bg-[var(--bg-card)] rounded-xl border ${colorClass} overflow-hidden shadow-lg animate-fade-in group flex flex-col`} style={{ animationDelay: `${index * 0.05}s` }}>
            <div className={`px-4 py-2 border-b ${colorClass} ${headerBg} flex items-center justify-between shrink-0`}>
                <div className="flex items-center gap-2">
                    <span className="text-xs">{icon}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-primary)] opacity-80">{item.type}</span>
                </div>
                <button
                    onClick={() => onUnpin(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                    ✕ Remove
                </button>
            </div>

            <div className="p-4 flex-1 flex flex-col">
                <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug">{item.title}</h4>
                {item.subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{item.subtitle}</p>}

                {/* Optional Metrics Pills */}
                {item.metrics && Object.keys(item.metrics).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                        {Object.entries(item.metrics).map(([k, v]) => (
                            <span key={k} className="bg-black/40 border border-white/5 rounded px-2 py-0.5 text-[9px] font-mono text-[var(--accent-cyan)]">
                                {k}: {v}
                            </span>
                        ))}
                    </div>
                )}

                {/* Optional Content details */}
                {item.content && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
                        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed italic line-clamp-4">
                            {item.content.length > 150 ? item.content.substring(0, 150) + "..." : item.content}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
