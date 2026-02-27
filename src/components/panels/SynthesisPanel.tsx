'use client';

interface TargetResearcherMapping {
    target: string;
    researchers: string[];
    coverage: string; // WELL_COVERED | SPARSE | GAP
}

interface SynthesisPanelProps {
    mappings: TargetResearcherMapping[];
    keyInsight?: string;
    gaps?: string[];
}

const COVERAGE_STYLE: Record<string, { bg: string, text: string, label: string }> = {
    'WELL_COVERED': { bg: 'rgba(52,211,153,0.15)', text: 'var(--accent-green)', label: '● Covered' },
    'SPARSE': { bg: 'rgba(251,191,36,0.15)', text: 'var(--accent-amber)', label: '◐ Sparse' },
    'GAP': { bg: 'rgba(248,113,113,0.15)', text: 'var(--accent-red)', label: '○ Gap' },
};

export default function SynthesisPanel({ mappings, keyInsight, gaps }: SynthesisPanelProps) {
    return (
        <div className="h-full flex flex-col">
            {/* Key Insight */}
            {keyInsight && (
                <div className="px-5 py-4 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 border-b border-[var(--border-default)]">
                    <p className="text-[9px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider mb-1">🧬 Key Finding</p>
                    <p className="text-xs text-[var(--text-primary)] leading-relaxed font-medium">{keyInsight}</p>
                </div>
            )}

            {/* Coverage Matrix */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-5 py-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">Target × Researcher Coverage</span>
                </div>

                <div className="divide-y divide-[var(--border-default)]">
                    {mappings.map((m, i) => {
                        const style = COVERAGE_STYLE[m.coverage] || COVERAGE_STYLE['GAP'];
                        return (
                            <div key={i} className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-[var(--accent-cyan)]">{m.target}</span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: style.text, background: style.bg }}>
                                        {style.label}
                                    </span>
                                </div>
                                {m.researchers.length > 0 ? (
                                    <div className="flex gap-1.5 flex-wrap">
                                        {m.researchers.map((name, j) => (
                                            <span key={j} className="text-[9px] bg-[var(--bg-input)] border border-[var(--border-default)] text-[var(--text-secondary)] px-2 py-0.5 rounded">
                                                {name}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-[9px] text-red-400 italic">No researchers identified for this target</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Gaps */}
            {gaps && gaps.length > 0 && (
                <div className="px-5 py-3 border-t border-[var(--border-default)] bg-red-500/5">
                    <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider mb-1.5">⚠ Research Gaps</p>
                    {gaps.map((g, i) => (
                        <p key={i} className="text-[10px] text-[var(--text-secondary)] leading-relaxed">• {g}</p>
                    ))}
                </div>
            )}
        </div>
    );
}
