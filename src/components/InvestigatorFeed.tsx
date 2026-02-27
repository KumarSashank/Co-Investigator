'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { DeepResearchPlan, PlanStep } from '@/types';
import PlanReview from './PlanReview';

interface InvestigatorFeedProps {
    session: DeepResearchPlan | null;
    isExecuting: boolean;
    onPlanCreated: (planObj: DeepResearchPlan) => void;
    onApproval: (approved: boolean, choice?: string, feedback?: string) => void;
    // Plan Review props
    planDraft?: DeepResearchPlan | null;
    onPlanApproved?: (steps: PlanStep[]) => void;
    onPlanRefine?: (feedback: string) => void;
    isRefining?: boolean;
    onPinItem?: (item: any) => void; // kept for backwards compat
}

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

export default function InvestigatorFeed({ session, isExecuting, onPlanCreated, onApproval, planDraft, onPlanApproved, onPlanRefine, isRefining }: InvestigatorFeedProps) {
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [localMessages, setLocalMessages] = useState<{ id: string, text: string, sender: 'user' | 'system', time: Date }[]>([]);

    const feedEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [session, localMessages, isTyping, planDraft, scrollToBottom]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isTyping || isExecuting) return;

        setLocalMessages(prev => [...prev, { id: `msg-${Date.now()}`, text, sender: 'user', time: new Date() }]);
        setInput('');
        setIsTyping(true);

        try {
            const res = await fetch('/api/agent/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text }),
            });

            const data = await res.json();

            if (data.status === 'success' && data.plan) {
                onPlanCreated(data.plan);
            } else {
                setLocalMessages(prev => [...prev, { id: `sys-${Date.now()}`, text: `⚠️ Error: ${data.error}`, sender: 'system', time: new Date() }]);
            }
        } catch (err: any) {
            setLocalMessages(prev => [...prev, { id: `sys-${Date.now()}`, text: `⚠️ Network error: ${err.message}`, sender: 'system', time: new Date() }]);
        }

        setIsTyping(false);
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-primary)] border-r border-[var(--border-default)]">
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-default)] bg-[var(--bg-secondary)] shrink-0 flex items-center gap-3">
                <span className="text-lg">🕵️</span>
                <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)]">Investigation</h2>
                    <p className="text-[10px] text-[var(--text-muted)]">
                        {planDraft ? 'Review proposed plan' : session ? `${session.plan.filter(s => s.status === 'DONE').length}/${session.plan.length} steps complete` : 'Ready'}
                    </p>
                </div>
            </div>

            {/* Feed Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Initial State */}
                {!session && !planDraft && localMessages.length === 0 && (
                    <div className="text-center mt-12 opacity-40">
                        <span className="text-4xl mb-4 block">🧪</span>
                        <p className="text-xs text-[var(--text-primary)] font-medium">Define your research objective</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1 max-w-[240px] mx-auto leading-relaxed">
                            e.g. "Identify novel targets for IPF and find the top 5 KOLs conducting relevant clinical trials"
                        </p>
                    </div>
                )}

                {/* User queries */}
                {localMessages.map(msg => (
                    msg.sender === 'user' ? (
                        <div key={msg.id} className="flex gap-3 items-start">
                            <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 text-[9px] font-bold border border-blue-500/30">PI</div>
                            <p className="text-xs font-medium text-[var(--text-primary)] pt-0.5 leading-relaxed">{msg.text}</p>
                        </div>
                    ) : (
                        <div key={msg.id} className="text-[10px] text-red-400 bg-red-400/10 p-2 rounded">{msg.text}</div>
                    )
                ))}

                {/* Plan Review (shown before execution) */}
                {planDraft && onPlanApproved && onPlanRefine && (
                    <div>
                        <div className="flex gap-3 items-start mb-2">
                            <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 text-[9px] font-bold border border-cyan-500/30">AI</div>
                            <p className="text-xs text-[var(--text-primary)] pt-0.5">Here's my proposed investigation protocol. Review, edit, or refine before I execute:</p>
                        </div>
                        <PlanReview
                            steps={planDraft.plan}
                            onApprove={onPlanApproved}
                            onRefine={onPlanRefine}
                            isRefining={isRefining || false}
                        />
                    </div>
                )}

                {/* Execution Protocol Timeline (after approval) */}
                {session && session.plan.map((step, idx) => (
                    <FeedStepBlock key={step.id} step={step} index={idx} isExecuting={isExecuting} onApproval={onApproval} session={session} />
                ))}

                {/* Running Indicator */}
                {(isTyping || isExecuting) && (
                    <div className="flex gap-3 items-center opacity-60">
                        <div className="w-5 h-5 rounded-full bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center shrink-0">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)]">{isTyping ? 'Generating plan...' : 'Agents executing...'}</p>
                    </div>
                )}

                <div ref={feedEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] shrink-0">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={session ? "Extend this investigation..." : "State your research objective..."}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg pl-4 pr-14 py-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
                        disabled={isTyping || isExecuting || !!planDraft}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isTyping || isExecuting || !input.trim() || !!planDraft}
                        className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded px-3 transition-colors flex items-center justify-center"
                    >
                        <span className="text-[10px] font-bold uppercase tracking-wider">Run</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

// Compact timeline step
function FeedStepBlock({ step, index, isExecuting, onApproval, session }: { step: PlanStep, index: number, isExecuting: boolean, onApproval: any, session: DeepResearchPlan }) {
    const isThisStepBlocked = step.status === 'RUNNING' && step.tools.includes('hitl_pause') && session.awaiting_confirmation;

    return (
        <div className="relative pl-7 animate-fade-in">
            {/* Timeline connector */}
            <div className="absolute left-[9px] top-5 bottom-[-8px] w-[1px]"
                style={{ background: step.status === 'DONE' ? 'var(--accent-green)' : 'var(--border-default)' }}
            />

            {/* Status dot */}
            <div className="absolute left-0 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-[8px] z-10"
                style={{
                    background: 'var(--bg-card)',
                    borderColor: step.status === 'DONE' ? 'var(--accent-green)' : step.status === 'RUNNING' ? 'var(--accent-blue)' : step.status === 'FAILED' ? 'var(--accent-red)' : 'var(--border-default)',
                    boxShadow: step.status === 'RUNNING' ? '0 0 8px var(--accent-blue-glow)' : 'none'
                }}>
                {step.status === 'DONE' ? '✓' : step.status === 'FAILED' ? '✕' : step.status === 'RUNNING' ? (
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                ) : (
                    <span className="text-[var(--text-muted)]">{index + 1}</span>
                )}
            </div>

            <div className="pb-3">
                <span className="text-[8px] font-mono text-[var(--text-muted)] uppercase tracking-widest">{step.intent}</span>
                <p className="text-[11px] font-semibold text-[var(--text-primary)] leading-snug mt-0.5">{step.name}</p>

                <div className="flex gap-1 mt-1 flex-wrap">
                    {step.tools.map(t => (
                        <span key={t} className="text-[8px] font-mono bg-black/20 text-[var(--text-muted)] px-1.5 py-0.5 rounded">
                            {TOOL_ICONS[t] || '⚙️'} {t}
                        </span>
                    ))}
                </div>

                {/* 1-line result summary */}
                {step.status === 'DONE' && step.result_data?.ai_analysis && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 italic leading-relaxed line-clamp-1 border-l-2 border-green-500/30 pl-2">
                        {step.result_data.ai_analysis.disease_summary || step.result_data.ai_analysis.key_insight || '✓ Complete'}
                    </p>
                )}

                {/* HITL */}
                {isThisStepBlocked && !isExecuting && (
                    <HITLBlock session={session} onApproval={onApproval} />
                )}
            </div>
        </div>
    );
}

function HITLBlock({ session, onApproval }: { session: DeepResearchPlan, onApproval: any }) {
    const [feedback, setFeedback] = useState('');
    return (
        <div className="mt-2 p-3 rounded border border-amber-500/30 bg-amber-500/5 animate-pulse-soft">
            <h4 className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1.5 mb-1.5">⚠️ Human Override Required</h4>
            <p className="text-[11px] text-[var(--text-primary)] mb-2 leading-relaxed">
                {session.checkpoint_question || "Proceed?"}
            </p>
            <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Optional instructions..."
                className="w-full bg-black/40 border border-amber-500/20 rounded p-2 text-[10px] text-[var(--text-primary)] mb-2 resize-none h-12"
            />
            <div className="flex gap-2">
                {session.checkpoint_options?.length ? (
                    session.checkpoint_options.map((opt, i) => (
                        <button key={i} onClick={() => { onApproval(true, opt, feedback); setFeedback(''); }} className="flex-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 text-[9px] font-bold py-1.5 rounded transition-colors border border-amber-500/30">{opt}</button>
                    ))
                ) : (
                    <>
                        <button onClick={() => { onApproval(true, undefined, feedback); setFeedback(''); }} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[9px] font-bold py-1.5 rounded transition-colors border border-green-500/20">✓ Approve</button>
                        <button onClick={() => { onApproval(false, undefined, feedback); setFeedback(''); }} className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[9px] font-bold py-1.5 rounded transition-colors border border-red-500/20">✕ Stop</button>
                    </>
                )}
            </div>
        </div>
    );
}
