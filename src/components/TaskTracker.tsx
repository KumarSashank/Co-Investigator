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
                    <TaskCard key={task.id} task={task} index={idx} isLast={idx === plan.length - 1} artifacts={session.artifacts} />
                ))}
            </div>

            {/* HITL Checkpoint - Dynamic Rendering */}
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
                            // Dynamic Multiple Choice
                            session.checkpoint_options.map((opt, i) => (
                                <button key={i} onClick={() => handleOptionSelect(opt)} className="btn-approve text-left text-xs py-2 px-3 rounded-lg border border-[var(--border-accent)]">
                                    {opt}
                                </button>
                            ))
                        ) : (
                            // Fallback yes/no
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

function TaskCard({ task, index, isLast, artifacts }: { task: PlanStep; index: number; isLast: boolean, artifacts: Record<string, string> }) {
    const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
    const isRunning = task.status === 'RUNNING';

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
                }}
            >
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {task.name}
                    </p>
                    <span className={`badge badge-${task.status.toLowerCase()} shrink-0`}>
                        {config.label}
                    </span>
                </div>

                {/* Tools Listed */}
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

                {/* Show GCS Artifact Link if available */}
                {artifacts && artifacts[task.id] && (
                    <div className="mt-2.5 pt-2 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-default)' }}>
                        <span className="text-[12px]">📦</span>
                        <span className="text-[9px] font-mono truncate hover:text-white cursor-pointer transition-colors" style={{ color: 'var(--text-muted)' }}>
                            {artifacts[task.id]}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
