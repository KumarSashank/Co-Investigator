'use client';

import { useState } from 'react';
import { DeepResearchPlan, PlanStep } from '@/types';

interface EvidenceDashboardProps {
    session: DeepResearchPlan | null;
    onGenerateReport: () => void;
}

const INTENT_CONFIG: Record<string, { icon: string, accent: string, label: string }> = {
    retrieve: { icon: '🗄️', accent: 'var(--accent-cyan)', label: 'Data Retrieval' },
    rank: { icon: '📊', accent: 'var(--accent-amber)', label: 'Ranking & Scoring' },
    verify: { icon: '🔬', accent: 'var(--accent-green)', label: 'Verification' },
    extract: { icon: '📋', accent: 'var(--accent-blue)', label: 'Extraction' },
    synthesize: { icon: '🧬', accent: 'var(--accent-cyan)', label: 'Synthesis' },
    other: { icon: '⚙️', accent: 'var(--text-muted)', label: 'Processing' },
};

const SOURCE_BADGES: Record<string, { icon: string, label: string, color: string }> = {
    bigquery: { icon: '🗄️', label: 'BigQuery', color: '#F4B400' },
    openalex_search_authors: { icon: '🔬', label: 'OpenAlex', color: '#E65100' },
    openalex_get_author: { icon: '🔬', label: 'OpenAlex', color: '#E65100' },
    pubmed_search: { icon: '📄', label: 'PubMed', color: '#2196F3' },
    pubmed_fetch: { icon: '📄', label: 'PubMed', color: '#2196F3' },
    vertex_search_retrieve: { icon: '🔍', label: 'Vertex AI Search', color: '#4285F4' },
    hitl_pause: { icon: '⏸️', label: 'Human Review', color: '#FF6D00' },
};

export default function EvidenceDashboard({ session, onGenerateReport }: EvidenceDashboardProps) {
    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 relative overflow-hidden">
                {/* Subtle grid background */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                <div className="relative z-10">
                    <div className="text-5xl mb-6 opacity-30">📊</div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Evidence Dashboard</h3>
                    <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                        Begin an investigation in the feed. Evidence cards will auto-populate here as each agent step completes.
                    </p>
                </div>
            </div>
        );
    }

    const completedSteps = session.plan.filter(s => s.status === 'DONE' && s.result_data);
    const runningSteps = session.plan.filter(s => s.status === 'RUNNING');
    const pendingSteps = session.plan.filter(s => s.status === 'PENDING');
    const allDone = session.plan.every(s => s.status === 'DONE' || s.status === 'FAILED');

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        📊 Evidence Dashboard
                    </h2>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                        {completedSteps.length}/{session.plan.length} steps completed
                        {runningSteps.length > 0 && <span className="text-[var(--accent-blue)] ml-2">• {runningSteps.length} running</span>}
                    </p>
                </div>

                {allDone && (
                    <button
                        onClick={onGenerateReport}
                        className="bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-[11px] font-bold px-5 py-2.5 rounded-lg transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] flex items-center gap-2"
                    >
                        <span>📝</span> Generate Synthesis Report
                    </button>
                )}
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-[var(--bg-input)] shrink-0">
                <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 ease-out"
                    style={{ width: `${(completedSteps.length / Math.max(session.plan.length, 1)) * 100}%` }}
                />
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {session.plan.map((step, idx) => (
                        <StepEvidenceCard key={step.id} step={step} index={idx} />
                    ))}
                </div>
            </div>
        </div>
    );
}


function StepEvidenceCard({ step, index }: { step: PlanStep, index: number }) {
    const [expanded, setExpanded] = useState(false);
    const config = INTENT_CONFIG[step.intent] || INTENT_CONFIG['other'];

    const isDone = step.status === 'DONE';
    const isRunning = step.status === 'RUNNING';
    const isFailed = step.status === 'FAILED';
    const isPending = step.status === 'PENDING';

    const analysis = step.result_data?.ai_analysis;

    // Extract data counts from the analysis
    const dataCounts = extractDataCounts(analysis);

    return (
        <div
            className={`rounded-xl border overflow-hidden transition-all duration-300 animate-fade-in ${isRunning ? 'border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.15)]' :
                isDone ? 'border-[var(--border-default)] hover:border-[var(--border-accent)]' :
                    isFailed ? 'border-red-500/30' :
                        'border-[var(--border-default)] opacity-50'
                }`}
            style={{ animationDelay: `${index * 0.08}s`, background: 'var(--bg-card)' }}
        >
            {/* Card Header */}
            <div
                className="px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => isDone && setExpanded(!expanded)}
            >
                {/* Status Indicator */}
                <div className="mt-0.5 shrink-0">
                    {isRunning ? (
                        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    ) : isDone ? (
                        <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-[10px] text-green-400">✓</div>
                    ) : isFailed ? (
                        <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-[10px] text-red-400">✕</div>
                    ) : (
                        <div className="w-5 h-5 rounded-full border border-[var(--border-default)] bg-[var(--bg-input)]" />
                    )}
                </div>

                {/* Step Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: config.accent, background: `color-mix(in srgb, ${config.accent} 10%, transparent)` }}>
                            {config.label}
                        </span>
                        <span className="text-[9px] text-[var(--text-muted)]">S{index + 1}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{step.name}</h4>

                    {/* Tools used */}
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                        {step.tools.map(t => (
                            <span key={t} className="text-[8px] font-mono bg-black/30 text-[var(--text-muted)] px-1.5 py-0.5 rounded">
                                {t}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Expand/Collapse chevron */}
                {isDone && (
                    <span className="text-[var(--text-muted)] text-xs mt-1 shrink-0 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
                        ▾
                    </span>
                )}
            </div>

            {/* Data Provenance Badges (always visible when done) */}
            {isDone && (
                <div className="px-4 pb-2 flex gap-1.5 flex-wrap items-center">
                    {step.tools.filter(t => t !== 'none' && t !== 'hitl_pause').map(tool => {
                        const badge = SOURCE_BADGES[tool];
                        if (!badge) return null;
                        return (
                            <span
                                key={tool}
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border"
                                style={{ borderColor: `${badge.color}40`, color: badge.color, background: `${badge.color}10` }}
                            >
                                {badge.icon} {badge.label}
                            </span>
                        );
                    })}
                    {/* AI Analysis badge */}
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border" style={{ borderColor: 'rgba(168,85,247,0.3)', color: 'rgb(168,85,247)', background: 'rgba(168,85,247,0.08)' }}>
                        🤖 AI Analysis
                    </span>
                    {/* Confidence badge */}
                    {analysis?.confidence && (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border ml-auto
                            ${analysis.confidence === 'HIGH' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                                analysis.confidence === 'MEDIUM' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' :
                                    'border-red-500/30 text-red-400 bg-red-500/10'
                            }`}
                        >
                            {analysis.confidence === 'HIGH' ? '✓' : analysis.confidence === 'MEDIUM' ? '~' : '!'} {analysis.confidence} confidence
                        </span>
                    )}
                </div>
            )}

            {/* Quick Stats Row (always visible when done) */}
            {isDone && dataCounts.length > 0 && (
                <div className="px-4 pb-3 flex gap-2 flex-wrap">
                    {dataCounts.map((dc, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-black/20 border border-white/5 rounded-full px-2.5 py-1 text-[9px] font-mono" style={{ color: config.accent }}>
                            <span>{dc.icon}</span> {dc.count} {dc.label}
                        </span>
                    ))}
                </div>
            )}

            {/* Running Animation */}
            {isRunning && (
                <div className="px-4 pb-3">
                    <div className="flex gap-2 items-center">
                        <div className="flex-1 h-1 bg-[var(--bg-input)] rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full animate-[gradient-shift_2s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
                        </div>
                        <span className="text-[9px] text-blue-400 font-mono">Processing...</span>
                    </div>
                </div>
            )}

            {/* Expanded Content: Full AI Analysis */}
            {isDone && expanded && analysis && (
                <div className="border-t border-[var(--border-default)] bg-black/20">
                    <div className="p-4 space-y-3">
                        {/* Key Insight */}
                        {(analysis.disease_summary || analysis.key_insight) && (
                            <div className="bg-[var(--bg-input)] rounded-lg p-3 border-l-2" style={{ borderColor: config.accent }}>
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: config.accent }}>Key Insight</p>
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                    {analysis.disease_summary || analysis.key_insight}
                                </p>
                            </div>
                        )}

                        {/* Targets Table */}
                        {analysis.key_targets && analysis.key_targets.length > 0 && (
                            <EvidenceTable
                                title="Identified Targets"
                                icon="🎯"
                                columns={['Target', 'Relevance']}
                                rows={analysis.key_targets.map((t: any) => [t.name || t.target, t.relevance || t.score || '-'])}
                            />
                        )}

                        {/* Researchers Table */}
                        {analysis.ranked_researchers && analysis.ranked_researchers.length > 0 && (
                            <EvidenceTable
                                title="Key Opinion Leaders"
                                icon="👥"
                                columns={['Researcher', 'Relevance Score']}
                                rows={analysis.ranked_researchers.map((r: any) => [r.name, r.relevance_score || r.score || '-'])}
                            />
                        )}

                        {/* Contacts */}
                        {analysis.contacts && analysis.contacts.length > 0 && (
                            <EvidenceTable
                                title="Extracted Contacts"
                                icon="📧"
                                columns={['Name', 'Contact']}
                                rows={analysis.contacts.map((c: any) => [c.name, c.email || c.institution || '-'])}
                            />
                        )}

                        {/* Full AI text if nothing structured above */}
                        {!analysis.key_targets && !analysis.ranked_researchers && !analysis.contacts && (
                            <div className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                                {typeof analysis === 'string' ? analysis : JSON.stringify(analysis, null, 2)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Failed Error */}
            {isFailed && step.error && (
                <div className="px-4 pb-3">
                    <p className="text-[10px] text-red-400 bg-red-500/10 rounded p-2">{step.error}</p>
                </div>
            )}
        </div>
    );
}


function EvidenceTable({ title, icon, columns, rows }: { title: string, icon: string, columns: string[], rows: string[][] }) {
    return (
        <div className="rounded-lg border border-[var(--border-default)] overflow-hidden">
            <div className="px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-default)] flex items-center gap-2">
                <span className="text-xs">{icon}</span>
                <span className="text-[10px] font-bold text-[var(--text-primary)]">{title}</span>
                <span className="text-[9px] text-[var(--text-muted)] ml-auto">{rows.length} items</span>
            </div>
            <table className="w-full text-[10px]">
                <thead>
                    <tr className="bg-black/20">
                        {columns.map((col, i) => (
                            <th key={i} className="text-left px-3 py-1.5 text-[var(--text-muted)] font-semibold uppercase tracking-wider">{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-t border-[var(--border-default)] hover:bg-white/[0.02] transition-colors">
                            {row.map((cell, j) => (
                                <td key={j} className={`px-3 py-2 ${j === 0 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                                    {String(cell).length > 60 ? String(cell).substring(0, 60) + '...' : String(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}


function extractDataCounts(analysis: any): { icon: string, count: number, label: string }[] {
    if (!analysis) return [];
    const counts: { icon: string, count: number, label: string }[] = [];

    if (analysis.key_targets?.length) counts.push({ icon: '🎯', count: analysis.key_targets.length, label: 'targets' });
    if (analysis.ranked_researchers?.length) counts.push({ icon: '👥', count: analysis.ranked_researchers.length, label: 'researchers' });
    if (analysis.contacts?.length) counts.push({ icon: '📧', count: analysis.contacts.length, label: 'contacts' });
    if (analysis.papers_found !== undefined) counts.push({ icon: '📄', count: analysis.papers_found, label: 'papers' });
    if (analysis.key_findings?.length) counts.push({ icon: '💡', count: analysis.key_findings.length, label: 'findings' });

    return counts;
}
