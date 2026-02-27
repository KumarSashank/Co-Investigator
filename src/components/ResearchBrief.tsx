'use client';

import { useMemo } from 'react';

interface ResearchBriefProps {
    markdown: string;
    groundingScore: number;
}

/* ---- Markdown → HTML for PDF Export ---- */
function markdownToHtml(md: string): string {
    let html = md
        // Escape HTML entities first
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Tables: process before other block elements
    html = html.replace(/^(\|.+\|)\n(\|[\s\-:|]+\|)\n((?:\|.+\|\n?)+)/gm, (_match, header, _sep, body) => {
        const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
        const rows = body.trim().split('\n').map((row: string) => {
            const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
            return `<tr>${cells}</tr>`;
        }).join('');
        return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
    });

    html = html
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Horizontal rules
        .replace(/^---+$/gm, '<hr/>')
        // Bold & Italic
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`(.+?)`/g, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Unordered lists
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        // Numbered lists
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        // Wrap consecutive <li> in <ul>
        .replace(/((?:<li>.+<\/li>\n?)+)/g, '<ul>$1</ul>')
        // Paragraphs: lines not already wrapped in block elements
        .replace(/^(?!<[hultdoa]|<\/|<hr)(.+)$/gm, '<p>$1</p>')
        // Clean up double line breaks
        .replace(/\n{2,}/g, '\n');

    return html;
}

export default function ResearchBrief({ markdown, groundingScore }: ResearchBriefProps) {
    if (!markdown) {
        return (
            <div className="glass-card p-12 text-center animate-fade-in">
                <div className="text-4xl mb-3 opacity-30">📋</div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No research brief generated yet.
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    The final brief will appear here once the investigation is complete.
                </p>
            </div>
        );
    }

    const handleDownloadMD = () => {
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `co-investigator-report-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        // Create a hidden iframe with styled content for print
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups for PDF export');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Co-Investigator Research Report</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        color: #1a1a2e; background: #fff;
                        padding: 40px 50px; line-height: 1.6; font-size: 13px;
                    }
                    h1 { font-size: 22px; margin: 24px 0 12px; color: #0f0f23; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; }
                    h2 { font-size: 17px; margin: 20px 0 10px; color: #1a1a3e; }
                    h3 { font-size: 14px; margin: 16px 0 8px; color: #2a2a4e; }
                    p { margin: 6px 0; }
                    ul, ol { margin: 6px 0 6px 24px; }
                    li { margin: 3px 0; }
                    table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 11px; }
                    th { background: #f0f0f5; font-weight: 600; text-align: left; padding: 8px 10px; border: 1px solid #ddd; }
                    td { padding: 6px 10px; border: 1px solid #ddd; }
                    tr:nth-child(even) { background: #f8f8fc; }
                    code { background: #f0f0f5; padding: 1px 4px; border-radius: 3px; font-size: 12px; }
                    strong { color: #0f0f23; }
                    a { color: #2563eb; text-decoration: underline; }
                    hr { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }
                    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
                    .header h1 { border: none; font-size: 24px; margin: 0; }
                    .header p { color: #666; font-size: 11px; margin-top: 6px; }
                    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; text-align: center; color: #888; font-size: 10px; }
                    @media print { body { padding: 20px 30px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔬 Co-Investigator Research Report</h1>
                    <p>Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                ${markdownToHtml(markdown)}
                <div class="footer">
                    <p>Generated by BenchSpark Co-Investigator — Powered by Vertex AI</p>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();

        // Wait for content to render, then trigger print dialog
        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    return (
        <div className="glass-card p-6 animate-slide-up space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--border-default)' }}>
                <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        Final Research Brief
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Generated by Vertex AI with Google Search grounding
                    </p>
                </div>
                <GroundingScore score={groundingScore} />
            </div>

            {/* Grounding Guardrails Banner */}
            <div className="rounded-lg border border-[var(--accent-green)]/20 bg-[var(--accent-green)]/5 p-3 flex items-start gap-3">
                <span className="text-base shrink-0 mt-0.5">🛡️</span>
                <div>
                    <p className="text-[10px] font-bold text-[var(--accent-green)] uppercase tracking-wider mb-1">Grounding & Guardrails</p>
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                        This report is generated using <strong>Google Search Grounding</strong> for external fact verification.
                        All claims reference retrieved data from BigQuery, OpenAlex, and PubMed — no fabricated citations.
                        Each step was processed by a domain-specialist AI agent with source provenance tracking.
                    </p>
                </div>
            </div>

            {/* Markdown Content */}
            <div className="prose-dark">
                <SimpleMarkdown content={markdown} />
            </div>

            {/* Footer with Download Buttons */}
            <div
                className="pt-4 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--border-default)' }}
            >
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Generated by BenchSpark Co-Investigator — Challenge 7
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={handleDownloadMD}
                        className="text-[10px] px-3 py-1.5 rounded-lg border transition-all hover:scale-105"
                        style={{
                            borderColor: 'var(--border-accent)',
                            color: 'var(--accent-cyan)',
                            background: 'rgba(0, 212, 255, 0.05)',
                        }}
                    >
                        📄 Download .md
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="btn-primary text-[10px] px-3 py-1.5 rounded-lg transition-all hover:scale-105"
                    >
                        📥 Export PDF
                    </button>
                </div>
            </div>
        </div>
    );
}


/* ---- Grounding Score Ring ---- */
function GroundingScore({ score }: { score: number }) {
    const pct = Math.round(score * 100);
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (score * circumference);
    const color = score > 0.8 ? 'var(--accent-green)' : score > 0.5 ? 'var(--accent-amber)' : 'var(--accent-red)';

    return (
        <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative w-16 h-16">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" className="score-ring-track" strokeWidth="6" />
                    <circle
                        cx="50" cy="50" r="40"
                        fill="none"
                        className="score-ring-fill"
                        stroke={color}
                        strokeWidth="6"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ '--score-offset': offset } as React.CSSProperties}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
                </div>
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Grounding
            </span>
        </div>
    );
}

/* ---- Simple Markdown Renderer ---- */
function SimpleMarkdown({ content }: { content: string }) {
    const elements = useMemo(() => parseMarkdown(content), [content]);
    return <>{elements}</>;
}

function parseMarkdown(md: string): React.ReactNode[] {
    const lines = md.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Horizontal rule
        if (/^---+$/.test(line.trim())) {
            nodes.push(<hr key={key++} />);
            i++;
            continue;
        }

        // Headers
        if (line.startsWith('### ')) {
            nodes.push(<h3 key={key++}>{inlineFormat(line.slice(4))}</h3>);
            i++;
            continue;
        }
        if (line.startsWith('## ')) {
            nodes.push(<h2 key={key++}>{inlineFormat(line.slice(3))}</h2>);
            i++;
            continue;
        }
        if (line.startsWith('# ')) {
            nodes.push(<h1 key={key++}>{inlineFormat(line.slice(2))}</h1>);
            i++;
            continue;
        }

        // Table
        if (line.includes('|') && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim())) {
            const headerCells = line.split('|').filter(Boolean).map(c => c.trim());
            i += 2; // skip header + separator
            const rows: string[][] = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
                rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()));
                i++;
            }
            nodes.push(
                <table key={key++}>
                    <thead>
                        <tr>{headerCells.map((h, j) => <th key={j}>{inlineFormat(h)}</th>)}</tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => (
                            <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{inlineFormat(cell)}</td>)}</tr>
                        ))}
                    </tbody>
                </table>
            );
            continue;
        }

        // Unordered list items
        if (/^[-*•]\s/.test(line.trim())) {
            const items: string[] = [];
            while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().slice(2));
                i++;
            }
            nodes.push(
                <ul key={key++}>{items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}</ul>
            );
            continue;
        }

        // Numbered list items
        if (/^\d+\.\s/.test(line.trim())) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+\.\s/, ''));
                i++;
            }
            nodes.push(
                <ol key={key++}>{items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}</ol>
            );
            continue;
        }

        // Empty line
        if (line.trim() === '') {
            i++;
            continue;
        }

        // Paragraph
        nodes.push(<p key={key++}>{inlineFormat(line)}</p>);
        i++;
    }

    return nodes;
}

function inlineFormat(text: string): React.ReactNode {
    // Split by bold, italic, code patterns and reconstruct
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let partKey = 0;

    while (remaining.length > 0) {
        // Bold
        const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
        // Italic
        const italicMatch = remaining.match(/\*(.*?)\*/);
        // Code
        const codeMatch = remaining.match(/`(.*?)`/);

        // Find earliest match
        const matches = [
            boldMatch ? { type: 'bold', match: boldMatch, idx: boldMatch.index! } : null,
            italicMatch && (!boldMatch || italicMatch.index! < boldMatch.index!) ? { type: 'italic', match: italicMatch, idx: italicMatch.index! } : null,
            codeMatch ? { type: 'code', match: codeMatch, idx: codeMatch.index! } : null,
        ].filter(Boolean) as { type: string; match: RegExpMatchArray; idx: number }[];

        if (matches.length === 0) {
            parts.push(remaining);
            break;
        }

        matches.sort((a, b) => a.idx - b.idx);
        const earliest = matches[0];

        if (earliest.idx > 0) {
            parts.push(remaining.slice(0, earliest.idx));
        }

        if (earliest.type === 'bold') {
            parts.push(<strong key={partKey++}>{earliest.match[1]}</strong>);
        } else if (earliest.type === 'italic') {
            parts.push(<em key={partKey++}>{earliest.match[1]}</em>);
        } else if (earliest.type === 'code') {
            parts.push(<code key={partKey++}>{earliest.match[1]}</code>);
        }

        remaining = remaining.slice(earliest.idx + earliest.match[0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
}
