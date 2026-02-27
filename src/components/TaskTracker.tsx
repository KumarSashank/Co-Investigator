'use client';

import { useState } from 'react';
import { DeepResearchPlan, PlanStep } from '@/types';

const STATUS_CONFIG: Record<string, { icon: string; label: string; dotClass: string }> = {
    DONE: { icon: '✓', label: 'Done', dotClass: 'bg-[var(--accent-green)]' },
    RUNNING: { icon: '►', label: 'Running', dotClass: 'bg-[var(--accent-blue)] animate-pulse-soft' },
    PENDING: { icon: '○', label: 'Pending', dotClass: 'bg-[var(--text-muted)]' },
    FAILED: { icon: '✕', label: 'Failed', dotClass: 'bg-[var(--accent-red)]' },
    BLOCKED: { icon: '⏸', label: 'Paused', dotClass: 'bg-[var(--accent-amber)]' },
};

const TOOL_ICONS: Record<string, string> = {
    bigquery: '🗄️',
    pubmed_search: '📄',
    pubmed_fetch: '📄',
    openalex_search_authors: '🔬',
    openalex_get_author: '🔬',
    vertex_search_retrieve: '🔍',
    hitl_pause: '⏸️',
    none: '🤖',
};

interface TaskTrackerProps {
    session: DeepResearchPlan | null;
    onApproval: (approved: boolean, choice?: string, feedback?: string) => void;
    isExecuting: boolean;
}

export default function TaskTracker({ session, onApproval, isExecuting }: TaskTrackerProps) {
    const [feedback, setFeedback] = useState('');

    if (!session) {
        return (
            <div className="glass-card p-8 text-center animate-fade-in">
                <div className="text-3xl mb-3 opacity-30">🔍</div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    No active investigation yet.
                </p>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Send a research query in the chat to get started.
                </p>
            </div>
        );
    }

    const plan = session.plan;
    const completedCount = plan.filter((t) => t.status === 'DONE').length;
    const progress = Math.round((completedCount / plan.length) * 100);

    const handleOptionSelect = (choice: string) => {
        onApproval(true, choice, feedback || undefined);
        setFeedback('');
    };

    const handleDeny = () => {
        onApproval(false, undefined, feedback || undefined);
        setFeedback('');
    };

    return (
        <div className="space-y-5 animate-slide-in-right">
            {/* Session Info */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        {session.session_id}
                    </span>
                    <span className={`badge badge-${session.awaiting_confirmation ? 'BLOCKED' : 'RUNNING'}`}>
                        {session.awaiting_confirmation ? 'HITL PAUSED' : (isExecuting ? 'ACTIVE' : 'IDLE')}
                    </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {session.user_request}
                </p>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        <span>Progress</span>
                        <span>{completedCount}/{plan.length} steps</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--border-default)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${progress}%`,
                                background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-cyan))',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Task List */}
            <div className="relative space-y-0">
                {plan.map((task, idx) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        index={idx}
                        isLast={idx === plan.length - 1}
                        artifacts={session.artifacts}
                        sessionId={session.session_id}
                    />
                ))}
            </div>

            {/* HITL Checkpoint */}
            {session.awaiting_confirmation && !isExecuting && (
                <div className="hitl-card p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">⚠️</span>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--accent-amber)' }}>
                            Human-in-the-Loop Override
                        </h3>
                    </div>
                    <p className="text-xs leading-relaxed font-bold" style={{ color: 'var(--text-primary)' }}>
                        {session.checkpoint_question || "Agent halted for review. Do you want to proceed?"}
                    </p>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Optional constraints (e.g. 'Only include researchers in Europe')"
                        className="input-glow w-full px-3 py-2 rounded-lg text-xs resize-none h-16"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />

                    <div className="flex flex-col gap-2 mt-2">
                        {session.checkpoint_options && session.checkpoint_options.length > 0 ? (
                            session.checkpoint_options.map((opt, i) => (
                                <button key={i} onClick={() => handleOptionSelect(opt)} className="btn-approve text-left text-xs py-2 px-3 rounded-lg border border-[var(--border-accent)]">
                                    {opt}
                                </button>
                            ))
                        ) : (
                            <div className="flex gap-2">
                                <button onClick={() => handleOptionSelect('Approve')} className="btn-approve flex-1 text-sm py-2.5 rounded-lg">
                                    ✓ Approve & Continue
                                </button>
                                <button onClick={handleDeny} className="btn-deny flex-1 text-sm py-2.5 rounded-lg">
                                    ✕ Stop Sequence
                                </button>
                            </div>
                        )}
                        {session.checkpoint_options?.length! > 0 && (
                            <button onClick={handleDeny} className="btn-deny w-full text-xs py-2 rounded-lg mt-2">
                                🛑 Cancel Execution
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Executing indicator */}
            {isExecuting && (
                <div className="glass-card p-4 text-center">
                    <div className="typing-indicator flex gap-1.5 justify-center mb-2">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Executing task...
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * TaskCard with Progressive Disclosure:
 * - Collapsed: step name, status, tools, 1-line AI insight
 * - Expanded: full AI analysis details
 * - Deep drill: "View Raw Data" fetches from /api/agent/step-details
 */
function TaskCard({
    task,
    index,
    isLast,
    artifacts,
    sessionId
}: {
    task: PlanStep;
    index: number;
    isLast: boolean;
    artifacts: Record<string, string>;
    sessionId: string;
}) {
    const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
    const isRunning = task.status === 'RUNNING';
    const isDone = task.status === 'DONE';

    const [expanded, setExpanded] = useState(false);
    const [rawData, setRawData] = useState<any>(null);
    const [loadingRaw, setLoadingRaw] = useState(false);

    // Extract the 1-line AI insight for the collapsed view
    const aiAnalysis = task.result_data?.ai_analysis;
    const agentName = aiAnalysis?.agent_name || '';
    const confidence = aiAnalysis?.confidence || '';
    const oneLineInsight = getOneLineInsight(aiAnalysis, task.intent);
    const dataCounts = task.result_data?.data_counts;

    // Fetch raw data on demand
    const fetchRawData = async () => {
        if (rawData) return; // Already loaded
        setLoadingRaw(true);
        try {
            const res = await fetch(`/api/agent/step-details?sessionId=${sessionId}&stepId=${task.id}`);
            const data = await res.json();
            setRawData(data.rawData || data);
        } catch (err) {
            console.error('Failed to fetch raw data:', err);
            setRawData({ error: 'Failed to load raw data' });
        }
        setLoadingRaw(false);
    };

    return (
        <div
            className="relative pl-10 pb-5"
            style={{ animationDelay: `${index * 0.08}s` }}
        >
            {/* Connector Line */}
            {!isLast && (
                <div
                    className="absolute left-[14px] top-[30px] bottom-0 w-[2px]"
                    style={{
                        background: task.status === 'DONE' ? 'var(--accent-green)' : 'var(--border-default)',
                    }}
                />
            )}

            {/* Status Dot */}
            <div className="absolute left-[7px] top-[6px]">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${config.dotClass}`}>
                    <span className="text-[8px] text-white font-bold">{config.icon}</span>
                </div>
            </div>

            {/* Card */}
            <div
                className={`glass-card glass-card-hover p-3.5 animate-fade-in ${isRunning ? 'animate-glow-pulse' : ''
                    }`}
                style={{
                    borderColor: isRunning ? 'var(--border-accent)' : undefined,
                    cursor: isDone ? 'pointer' : undefined,
                }}
                onClick={() => isDone && setExpanded(!expanded)}
            >
                {/* Header: Name + Status */}
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {task.name}
                    </p>
                    <span className={`badge badge-${task.status.toLowerCase()} shrink-0`}>
                        {config.label}
                    </span>
                </div>

                {/* Tools + Intent */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {task.tools.map((t, ti) => (
                        <span key={ti}
                            className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-[var(--border-default)]"
                            style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
                        >
                            {TOOL_ICONS[t] || '⚙️'} {t}
                        </span>
                    ))}
                    <span className="text-[9px] ml-auto font-bold uppercase" style={{ color: 'var(--accent-blue)' }}>
                        {task.intent}
                    </span>
                </div>

                {/* 1-Line AI Insight (collapsed view for done tasks) */}
                {isDone && oneLineInsight && (
                    <div className="mt-2.5 pt-2 flex items-start gap-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <span className="text-[10px] shrink-0">🧬</span>
                        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {oneLineInsight}
                        </p>
                        {confidence && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${confidence === 'HIGH' ? 'text-green-400 bg-green-400/10' :
                                confidence === 'MEDIUM' ? 'text-amber-400 bg-amber-400/10' :
                                    'text-red-400 bg-red-400/10'
                                }`}>
                                {confidence}
                            </span>
                        )}
                    </div>
                )}

                {/* Data counts (collapsed) */}
                {isDone && dataCounts && (
                    <div className="flex gap-3 mt-1.5">
                        {dataCounts.pubmed_results > 0 && (
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>📄 {dataCounts.pubmed_results} papers</span>
                        )}
                        {dataCounts.openalex_authors > 0 && (
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>🔬 {dataCounts.openalex_authors} authors</span>
                        )}
                        {dataCounts.bigquery_targets > 0 && (
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>🧬 {dataCounts.bigquery_targets} targets</span>
                        )}
                    </div>
                )}

                {/* Expand indicator */}
                {isDone && aiAnalysis && (
                    <div className="mt-2 text-center">
                        <span className="text-[9px] cursor-pointer" style={{ color: 'var(--accent-blue)' }}>
                            {expanded ? '▲ Collapse Details' : '▼ View Agent Analysis'}
                        </span>
                    </div>
                )}

                {/* EXPANDED: Full AI Analysis */}
                {expanded && aiAnalysis && (
                    <div className="mt-3 pt-3 space-y-3 animate-fade-in" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold" style={{ color: 'var(--accent-cyan)' }}>
                                🤖 {agentName}
                            </span>
                        </div>

                        {/* Render AI analysis fields dynamically */}
                        <AnalysisDetails analysis={aiAnalysis} />

                        {/* View Raw Data button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); fetchRawData(); }}
                            disabled={loadingRaw}
                            className="w-full text-[10px] py-1.5 rounded border border-[var(--border-default)] transition-colors hover:border-[var(--accent-blue)]"
                            style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}
                        >
                            {loadingRaw ? '⏳ Loading...' : (rawData ? '📦 Raw Data Loaded' : '📦 View Raw Data')}
                        </button>

                        {/* RAW DATA (deep drill) */}
                        {rawData && (
                            <div className="mt-2 p-2 rounded text-[9px] font-mono overflow-auto max-h-60"
                                style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                <pre className="whitespace-pre-wrap break-words">
                                    {JSON.stringify(rawData, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Extracts a single-line insight from the AI analysis based on step intent.
 */
function getOneLineInsight(analysis: any, intent: string): string {
    if (!analysis) return '';

    // Try common summary fields
    if (analysis.disease_summary) return analysis.disease_summary;
    if (analysis.field_trend) return analysis.field_trend;
    if (analysis.key_insight) return analysis.key_insight;

    // Fallback: count items
    if (analysis.ranked_researchers?.length) {
        return `Ranked ${analysis.ranked_researchers.length} researchers by relevance`;
    }
    if (analysis.key_targets?.length) {
        return `Identified ${analysis.key_targets.length} key targets`;
    }
    if (analysis.verified_profiles?.length) {
        return `Verified ${analysis.verified_profiles.length} researcher profiles`;
    }
    if (analysis.contacts?.length) {
        return `Extracted contact info for ${analysis.contacts.length} researchers`;
    }

    return '';
}

/**
 * Renders AI analysis fields in a clean, readable format.
 */
function AnalysisDetails({ analysis }: { analysis: any }) {
    if (!analysis) return null;

    return (
        <div className="space-y-2">
            {/* Key targets */}
            {analysis.key_targets && (
                <div>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>🎯 Key Targets</p>
                    {analysis.key_targets.map((t: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 py-0.5">
                            <span className="text-[9px] font-medium" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                            <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>{t.relevance}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Ranked researchers */}
            {analysis.ranked_researchers && (
                <div>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>👥 Ranked Researchers</p>
                    {analysis.ranked_researchers.slice(0, 5).map((r: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                            <span className="text-[9px]" style={{ color: 'var(--text-primary)' }}>
                                {i + 1}. {r.name}
                            </span>
                            <span className="text-[8px] px-1.5 rounded" style={{ background: 'var(--bg-input)', color: 'var(--accent-cyan)' }}>
                                Score: {r.relevance_score?.toFixed?.(1) || r.relevance_score || 'N/A'}
                            </span>
                        </div>
                    ))}
                    {analysis.top_3_collaborator_picks && (
                        <p className="text-[8px] mt-1" style={{ color: 'var(--accent-green)' }}>
                            ⭐ Top picks: {analysis.top_3_collaborator_picks.join(', ')}
                        </p>
                    )}
                </div>
            )}

            {/* Verified profiles */}
            {analysis.verified_profiles && (
                <div>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>✅ Verified Profiles</p>
                    {analysis.verified_profiles.map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between py-0.5">
                            <span className="text-[9px]" style={{ color: 'var(--text-primary)' }}>{v.name}</span>
                            <span className={`text-[8px] px-1.5 rounded ${v.status === 'ACTIVE' ? 'text-green-400 bg-green-400/10' :
                                v.status === 'RISING_STAR' ? 'text-cyan-400 bg-cyan-400/10' :
                                    'text-amber-400 bg-amber-400/10'
                                }`}>{v.status}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Contacts */}
            {analysis.contacts && (
                <div>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>📧 Contacts</p>
                    {analysis.contacts.map((c: any, i: number) => (
                        <div key={i} className="py-0.5">
                            <span className="text-[9px]" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                            <span className="text-[8px] ml-2" style={{ color: c.email ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                {c.email || `No email — ${c.institution}`}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Disease summary */}
            {analysis.disease_summary && (
                <div>
                    <p className="text-[9px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>📋 Summary</p>
                    <p className="text-[9px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.disease_summary}</p>
                </div>
            )}

            {/* Suggested search terms */}
            {analysis.suggested_search_terms && (
                <div className="flex flex-wrap gap-1">
                    {analysis.suggested_search_terms.map((term: string, i: number) => (
                        <span key={i} className="text-[8px] px-1.5 py-0.5 rounded-full border border-[var(--border-default)]" style={{ color: 'var(--text-muted)' }}>
                            {term}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
