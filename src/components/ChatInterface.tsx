'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

const MOCK_RESPONSES = [
    "I'll create a research plan to investigate that. Let me break this down into subtasks using BigQuery, PubMed, and OpenAlex...\n\n**Plan created with 5 steps:**\n1. Query BigQuery for disease-target associations\n2. Search PubMed for recent publications\n3. Identify key researchers via OpenAlex\n4. Cross-reference with clinical trial data\n5. Synthesize findings into a research brief",
    "Great question! I'm querying the Open Targets BigQuery dataset now. I found **3 high-confidence targets** for IPF:\n\n• **MUC5B** (score: 0.92) — Mucin production pathway\n• **TERT** (score: 0.87) — Telomere maintenance\n• **TGFB1** (score: 0.81) — TGF-β signaling\n\nShall I proceed to search PubMed for recent publications on these targets?",
    "I've identified **Dr. Ganesh Raghu** (h-index: 91, University of Washington) as the most prolific IPF researcher. I also found 12 other active investigators. Would you like me to compile the full research brief now?",
];

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init',
            role: 'assistant',
            text: "Hello! I'm your **Co-Investigator** — an AI research assistant powered by Vertex AI.\n\nI can help you investigate diseases, find genetic targets, identify key researchers, and synthesize literature. What would you like to research today?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const responseIdx = useRef(0);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, scrollToBottom]);

    const handleSend = () => {
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

        // Simulate AI response
        const delay = 1500 + Math.random() * 1500;
        setTimeout(() => {
            const response = MOCK_RESPONSES[responseIdx.current % MOCK_RESPONSES.length];
            responseIdx.current++;
            const assistantMsg: Message = {
                id: `asst-${Date.now()}`,
                role: 'assistant',
                text: response,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setIsTyping(false);
        }, delay);
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
                                // Bullet
                                if (line.startsWith('• ') || line.startsWith('- ')) {
                                    return (
                                        <p key={i} className="ml-2 my-0.5 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: '• ' + rendered.slice(2) }} />
                                    );
                                }
                                // Numbered
                                if (/^\d+\.\s/.test(line)) {
                                    return (
                                        <p key={i} className="ml-2 my-0.5 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: rendered }} />
                                    );
                                }
                                if (line === '') return <br key={i} />;
                                return (
                                    <p key={i} className="my-0.5 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: rendered }} />
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
                        placeholder="e.g., Find researchers who have published on IPF in the last 3 years"
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
                    Co-Investigator uses Vertex AI with Google Search grounding for verified research.
                </p>
            </div>
        </div>
    );
}
