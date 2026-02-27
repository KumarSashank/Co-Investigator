'use client';

import { useState } from 'react';

interface Paper {
    title: string;
    abstract?: string;
    authors?: string[];
    publicationDate?: string;
    pmid?: string;
    citationCount?: number;
    affiliations?: string[];
    correspondingEmail?: string | null;
}

interface LiteraturePanelProps {
    papers: Paper[];
}

export default function LiteraturePanel({ papers }: LiteraturePanelProps) {
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<'date' | 'citations'>('date');

    const sorted = [...papers].sort((a, b) => {
        if (sortBy === 'citations') return (b.citationCount || 0) - (a.citationCount || 0);
        return (b.publicationDate || '').localeCompare(a.publicationDate || '');
    });

    return (
        <div className="h-full flex flex-col">
            {/* Controls */}
            <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center justify-between bg-[var(--bg-secondary)]">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{papers.length} publications</span>
                <div className="flex gap-1">
                    <button onClick={() => setSortBy('date')} className={`text-[9px] px-2 py-1 rounded ${sortBy === 'date' ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)]'}`}>Recent</button>
                    <button onClick={() => setSortBy('citations')} className={`text-[9px] px-2 py-1 rounded ${sortBy === 'citations' ? 'bg-blue-500/20 text-blue-400' : 'text-[var(--text-muted)]'}`}>Cited</button>
                </div>
            </div>

            {/* Paper List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-default)]">
                {sorted.map((paper, i) => {
                    const isExpanded = expandedIdx === i;
                    return (
                        <div key={i}>
                            <div
                                className="px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                onClick={() => setExpandedIdx(isExpanded ? null : i)}
                            >
                                <h4 className="text-[11px] font-semibold text-[var(--text-primary)] leading-snug">{paper.title}</h4>
                                <div className="flex items-center gap-3 mt-1.5 text-[9px] text-[var(--text-muted)]">
                                    {paper.authors && paper.authors.length > 0 && (
                                        <span>{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''}</span>
                                    )}
                                    {paper.publicationDate && <span>• {paper.publicationDate}</span>}
                                    {paper.pmid && (
                                        <a href={`https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline" onClick={e => e.stopPropagation()}>
                                            PMID: {paper.pmid}
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Expanded: Abstract + Details */}
                            {isExpanded && (
                                <div className="px-5 pb-4 bg-[var(--bg-input)] border-t border-[var(--border-default)] animate-fade-in">
                                    {paper.abstract && (
                                        <div className="pt-3">
                                            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Abstract</p>
                                            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{paper.abstract}</p>
                                        </div>
                                    )}
                                    {paper.affiliations && paper.affiliations.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Affiliations</p>
                                            {paper.affiliations.map((a, j) => (
                                                <p key={j} className="text-[10px] text-[var(--text-muted)]">{a}</p>
                                            ))}
                                        </div>
                                    )}
                                    {paper.correspondingEmail && (
                                        <div className="mt-2 text-[10px]">
                                            <span className="text-[var(--text-muted)]">Contact: </span>
                                            <span className="text-[var(--accent-green)]">{paper.correspondingEmail}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
