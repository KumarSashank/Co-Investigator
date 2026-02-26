'use client';

import { useState } from 'react';
import { ResearchSession, SubTask } from '@/lib/types';

const STATUS_CONFIG: Record<string, { icon: string; label: string; dotClass: string }> = {
    completed: { icon: '✓', label: 'Completed', dotClass: 'bg-[var(--accent-green)]' },
    in_progress: { icon: '►', label: 'In Progress', dotClass: 'bg-[var(--accent-blue)] animate-pulse-soft' },
    pending: { icon: '○', label: 'Pending', dotClass: 'bg-[var(--text-muted)]' },
    failed: { icon: '✕', label: 'Failed', dotClass: 'bg-[var(--accent-red)]' },
};

const TOOL_ICONS: Record<string, string> = {
    bigquery: '🗄️',
    pubmed: '📄',
    openalex: '🔬',
    none: '🤖',
};

interface TaskTrackerProps {
    session: ResearchSession | null;
    onApprove: (feedback?: string) => void;
    onDeny: () => void;
}

export default function TaskTracker({ session, onApprove, onDeny }: TaskTrackerProps) {
    const [feedback, setFeedback] = useState('');

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-center space-y-3 animate-fade-in">
                <span className="text-3xl">🔬</span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    No active investigation yet.
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Type a research query in the chat to get started.
                </p>
            </div>
        );
    }

    const plan = session.plan;
    const completedCount = plan.filter((t) => t.status === 'completed').length;
    const progress = Math.round((completedCount / plan.length) * 100);

    return (
        <div className="space-y-5 animate-slide-in-right">
            {/* Session Info */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        {session.id}
                    </span>
                    <span className={`badge badge-${session.status}`}>
                        {session.status.replace('_', ' ')}
                    </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {session.originalQuery}
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
                    <TaskCard key={task.id} task={task} index={idx} isLast={idx === plan.length - 1} />
                ))}
            </div>

            {/* HITL Checkpoint */}
            {session.status === 'hitl_paused' && (
                <div className="hitl-card p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">⚠️</span>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--accent-amber)' }}>
                            Human-in-the-Loop Checkpoint
                        </h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        The agent has completed the initial data query and is requesting permission to proceed with the remaining tasks.
                    </p>
                    <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="Optional: Add feedback or constraints..."
                        className="input-glow w-full px-3 py-2 rounded-lg text-xs resize-none h-16"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => onApprove(feedback)}
                            className="btn-approve flex-1 text-sm py-2.5 rounded-lg"
                        >
                            ✓ Approve &amp; Continue
                        </button>
                        <button
                            onClick={onDeny}
                            className="btn-deny flex-1 text-sm py-2.5 rounded-lg"
                        >
                            ✕ Deny
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function TaskCard({ task, index, isLast }: { task: SubTask; index: number; isLast: boolean }) {
    const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
    const toolIcon = TOOL_ICONS[task.toolToUse] || '🤖';

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
                        background: task.status === 'completed' ? 'var(--accent-green)' : 'var(--border-default)',
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
                className={`glass-card glass-card-hover p-3.5 animate-fade-in ${task.status === 'in_progress' ? 'animate-glow-pulse' : ''}`}
                style={{
                    borderColor: task.status === 'in_progress' ? 'var(--border-accent)' : undefined,
                }}
            >
                <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {task.description}
                    </p>
                    <span className={`badge badge-${task.status} shrink-0`}>
                        {config.label}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm">{toolIcon}</span>
                    <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
                    >
                        {task.toolToUse}
                    </span>
                    <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                        Step {index + 1}
                    </span>
                </div>

                {/* Show result summary if completed */}
                {task.status === 'completed' && task.resultData && (
                    <div
                        className="mt-2.5 pt-2.5 text-[10px] leading-relaxed"
                        style={{ borderTop: '1px solid var(--border-default)', color: 'var(--text-muted)' }}
                    >
                        {task.resultData.associatedTargets && (
                            <span>
                                Found {task.resultData.associatedTargets.length} targets •{' '}
                                {task.resultData.pathways?.length || 0} pathways
                            </span>
                        )}
                        {task.resultData.displayName && (
                            <span>
                                Found {task.resultData.displayName} (h-index: {task.resultData.metrics?.hIndex || 'N/A'})
                            </span>
                        )}
                        {Array.isArray(task.resultData) && task.resultData.length > 0 && (
                            <span>
                                Found {task.resultData.length} publications
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
