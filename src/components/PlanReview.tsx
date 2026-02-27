'use client';

import { useState } from 'react';
import { PlanStep } from '@/types';

interface PlanReviewProps {
    steps: PlanStep[];
    onApprove: (steps: PlanStep[]) => void;
    onRefine: (feedback: string) => void;
    isRefining: boolean;
}

const INTENT_LABELS: Record<string, { icon: string, color: string }> = {
    retrieve: { icon: '🗄️', color: 'var(--accent-cyan)' },
    rank: { icon: '📊', color: 'var(--accent-amber)' },
    verify: { icon: '🔬', color: 'var(--accent-green)' },
    extract: { icon: '📋', color: 'var(--accent-blue)' },
    synthesize: { icon: '🧬', color: 'var(--accent-cyan)' },
    other: { icon: '⚙️', color: 'var(--text-muted)' },
};

export default function PlanReview({ steps, onApprove, onRefine, isRefining }: PlanReviewProps) {
    const [editableSteps, setEditableSteps] = useState<PlanStep[]>(steps);
    const [refineFeedback, setRefineFeedback] = useState('');
    const [showRefineInput, setShowRefineInput] = useState(false);
    const [expandedStep, setExpandedStep] = useState<string | null>(null);

    const handleRemoveStep = (id: string) => {
        setEditableSteps(prev => prev.filter(s => s.id !== id));
    };

    const handleAddStep = () => {
        const newStep: PlanStep = {
            id: `S${editableSteps.length + 1}`,
            name: 'New custom step',
            intent: 'other',
            tools: ['none'],
            inputs: {},
            expected_output: [],
            status: 'PENDING',
            notes: 'Manually added by investigator',
        };
        setEditableSteps(prev => [...prev, newStep]);
    };

    const handleStepNameEdit = (id: string, newName: string) => {
        setEditableSteps(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
    };

    return (
        <div className="mt-4 animate-fade-in">
            <div className="bg-[var(--bg-card)] border border-[var(--border-accent)] rounded-xl overflow-hidden shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                {/* Header */}
                <div className="px-4 py-3 bg-blue-500/5 border-b border-[var(--border-default)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">📋</span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">Proposed Investigation Protocol</span>
                        <span className="text-[9px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">{editableSteps.length} steps</span>
                    </div>
                </div>

                {/* Steps List */}
                <div className="divide-y divide-[var(--border-default)]">
                    {editableSteps.map((step, idx) => {
                        const config = INTENT_LABELS[step.intent] || INTENT_LABELS['other'];
                        const isExpanded = expandedStep === step.id;
                        return (
                            <div key={step.id} className="group hover:bg-white/[0.02] transition-colors">
                                <div className="px-4 py-3 flex items-start gap-3">
                                    {/* Step number */}
                                    <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5">
                                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border" style={{ borderColor: config.color, color: config.color, background: `color-mix(in srgb, ${config.color} 8%, transparent)` }}>
                                            {idx + 1}
                                        </span>
                                    </div>

                                    {/* Step content — full text, no truncation */}
                                    <div className="flex-1 min-w-0">
                                        <textarea
                                            value={step.name}
                                            onChange={(e) => handleStepNameEdit(step.id, e.target.value)}
                                            rows={Math.max(1, Math.ceil(step.name.length / 45))}
                                            className="w-full bg-transparent text-[11px] font-semibold text-[var(--text-primary)] border-none outline-none focus:bg-white/5 rounded px-1 -ml-1 transition-colors resize-none leading-relaxed"
                                        />
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[8px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ color: config.color, background: `color-mix(in srgb, ${config.color} 10%, transparent)` }}>
                                                {config.icon} {step.intent}
                                            </span>
                                            <button
                                                onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                                                className="text-[8px] text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors"
                                            >
                                                {isExpanded ? '▴ Less' : '▾ Details'}
                                            </button>
                                        </div>

                                        {/* Expanded details */}
                                        {isExpanded && (
                                            <div className="mt-2 pt-2 border-t border-[var(--border-default)] space-y-2 animate-fade-in">
                                                <div>
                                                    <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Tools</p>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {step.tools.map(t => (
                                                            <span key={t} className="text-[9px] font-mono bg-black/20 text-[var(--text-muted)] px-2 py-0.5 rounded">{t}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {step.notes && (
                                                    <div>
                                                        <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Notes</p>
                                                        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{step.notes}</p>
                                                    </div>
                                                )}
                                                {step.expected_output && step.expected_output.length > 0 && (
                                                    <div>
                                                        <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Expected Output</p>
                                                        <div className="flex gap-1 flex-wrap">
                                                            {step.expected_output.map((o, i) => (
                                                                <span key={i} className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded">{o}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Remove button */}
                                    <button
                                        onClick={() => handleRemoveStep(step.id)}
                                        className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 text-xs transition-all mt-1 shrink-0"
                                        title="Remove step"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add Step */}
                <button
                    onClick={handleAddStep}
                    className="w-full px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-blue-500/5 transition-colors border-t border-[var(--border-default)] flex items-center justify-center gap-1"
                >
                    + Add Step
                </button>

                {/* Actions Bar */}
                <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-default)] space-y-2">
                    {showRefineInput && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={refineFeedback}
                                onChange={(e) => setRefineFeedback(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && refineFeedback.trim()) {
                                        onRefine(refineFeedback.trim());
                                        setRefineFeedback('');
                                        setShowRefineInput(false);
                                    }
                                }}
                                placeholder="How should the plan change?"
                                className="flex-1 bg-[var(--bg-input)] border border-[var(--border-default)] rounded px-3 py-2 text-[10px] text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
                                autoFocus
                                disabled={isRefining}
                            />
                            <button
                                onClick={() => {
                                    if (refineFeedback.trim()) {
                                        onRefine(refineFeedback.trim());
                                        setRefineFeedback('');
                                        setShowRefineInput(false);
                                    }
                                }}
                                disabled={!refineFeedback.trim() || isRefining}
                                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-[10px] font-bold px-4 rounded transition-colors"
                            >
                                {isRefining ? '...' : 'Refine'}
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={() => onApprove(editableSteps)}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-[11px] font-bold py-2.5 rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2"
                        >
                            ✓ Approve & Execute
                        </button>
                        <button
                            onClick={() => setShowRefineInput(!showRefineInput)}
                            className="bg-[var(--bg-input)] hover:bg-white/10 text-[var(--text-primary)] text-[11px] font-bold py-2.5 px-5 rounded-lg transition-colors border border-[var(--border-default)]"
                        >
                            ✎ Refine
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
