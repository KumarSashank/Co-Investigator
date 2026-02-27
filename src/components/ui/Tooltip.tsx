import React, { useState } from 'react';

interface TooltipProps {
    children: React.ReactNode;
    content: string;
}

export default function Tooltip({ children, content }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <span
            className="relative inline-block cursor-help group"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <span className="border-b border-dashed border-[var(--text-muted)] transition-colors group-hover:border-[var(--accent-cyan)]">
                {children}
            </span>

            {isVisible && (
                <div className="absolute z-50 w-56 p-2.5 mt-2 left-1/2 -translate-x-1/2 bg-[var(--bg-secondary)] border border-[var(--border-accent)] rounded-lg shadow-xl text-[10px] leading-relaxed text-[var(--text-primary)] animate-fade-in pointer-events-none" style={{ backdropFilter: 'blur(12px)' }}>
                    {content}

                    {/* Subtle pointing arrow */}
                    <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--bg-secondary)] border-l border-t border-[var(--border-accent)] transform rotate-45" />
                </div>
            )}
        </span>
    );
}
