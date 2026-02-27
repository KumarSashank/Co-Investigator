'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { DeepResearchPlan, PlanStep } from '@/types';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

interface ChatInterfaceProps {
    onPlanCreated: (planObj: DeepResearchPlan) => void;
}

export default function ChatInterface({ onPlanCreated }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'assistant',
            text: "Hello! I'm **Benchie**.\n\nI can execute complex, multi-step research plans, fetch evidence, and synthesize grounded reports. What would you like to investigate today?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, scrollToBottom]);

    const handleSend = async () => {
        const text = input.trim();
        if (!text || isTyping) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            text,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
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
                const planObj: DeepResearchPlan = data.plan;

                // Format the plan into a readable message
                const planSteps = planObj.plan
                    .map((step: PlanStep, i: number) => {
                        const tools = step.tools.join(', ');
                        return `${i + 1}. **${step.name}** → \`${tools}\``;
                    })
                    .join('\n');

                const assistantMsg: Message = {
                    id: `asst-${Date.now()}`,
                    role: 'assistant',
                    text: `I've created a research plan with [tooltip:The number of distinct, sequential tool actions the planner agent determined are necessary to complete this specific investigation.](${planObj.plan.length} steps):\n\n${planSteps}\n\nStarting execution now — check the Investigation Plan panel on the right to track progress. I will pause when human confirmation is needed.`,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, assistantMsg]);

                // Notify parent to update session state and start execution
                onPlanCreated(planObj);
            } else {
                const errorMsg: Message = {
                    id: `asst-${Date.now()}`,
                    role: 'assistant',
                    text: `⚠️ I encountered an issue creating the research plan:\n\n\`${data.error || 'Unknown error'}\`\n\nThis might be a GCP authentication issue, or rate limiting.`,
                    timestamp: new Date(),
                };
                setMessages((prev) => [...prev, errorMsg]);
            }
        } catch (err: any) {
            const errorMsg: Message = {
                id: `asst-${Date.now()}`,
                role: 'assistant',
                text: `⚠️ Network error — couldn't reach the server:\n\n\`${err.message}\`\n\nMake sure the dev server is running.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMsg]);
        }

        setIsTyping(false);
    };

    const formatTime = (d: Date) =>
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="flex flex-col h-full relative">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {messages.map((msg, idx) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'msg-user' : 'msg-assistant'} px-5 py-3.5`}>
                            {/* Simple markdown-like rendering */}
                            {msg.text.split('\n').map((line, i) => {
                                // Bold
                                const rendered = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                // Code
                                const withCode = rendered.replace(/`([^`]+)`/g, '<code style="background:var(--bg-input);padding:1px 5px;border-radius:3px;font-size:0.85em;color:var(--accent-cyan)">$1</code>');
                                // Tooltip
                                const withTooltip = withCode.replace(/\[tooltip:(.*?)\]\((.*?)\)/g, '<span title="$1" style="border-bottom: 1px dotted var(--text-muted); cursor: help;" class="hover:border-[var(--accent-cyan)] transition-colors">$2</span>');

                                // Bullet
                                if (line.startsWith('• ') || line.startsWith('- ')) {
                                    return (
                                        <p key={i} className="ml-2 my-0.5 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: '• ' + withTooltip.slice(2) }} />
                                    );
                                }
                                // Numbered
                                if (/^\d+\.\s/.test(line)) {
                                    return (
                                        <p key={i} className="ml-2 my-0.5 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: withTooltip }} />
                                    );
                                }
                                if (line === '') return <br key={i} />;
                                return (
                                    <p key={i} className="my-0.5 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: withTooltip }} />
                                );
                            })}
                            <span
                                className={`block mt-2 text-[10px] ${msg.role === 'user' ? 'text-blue-200' : 'text-[var(--text-muted)]'}`}
                                suppressHydrationWarning
                            >
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="msg-assistant px-5 py-4">
                            <div className="typing-indicator flex gap-1.5">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
                <div className="flex gap-3">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="e.g., Identify active researchers in IPF target discovery"
                        className="input-glow flex-1 px-4 py-3 rounded-xl text-sm"
                        style={{
                            background: 'var(--bg-input)',
                            color: 'var(--text-primary)',
                        }}
                        disabled={isTyping}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isTyping || !input.trim()}
                        className="btn-primary px-6 py-3 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        <span className="flex items-center gap-2">
                            Send
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </span>
                    </button>
                </div>
                <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                    DeepResearch uses Vertex AI with strict grounded citations and tool execution.
                </p>
            </div>
        </div>
    );
}
