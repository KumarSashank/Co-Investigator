'use client';

interface Contact {
    name: string;
    email?: string;
    institution?: string;
    department?: string;
    contact_method?: string; // direct_email | institutional | not_found
    source_pmid?: string;
}

interface ContactsPanelProps {
    contacts: Contact[];
    emailsFound?: number;
    emailsMissing?: number;
}

const METHOD_BADGES: Record<string, { label: string, color: string }> = {
    'direct_email': { label: '✅ Direct', color: 'var(--accent-green)' },
    'institutional': { label: '🔗 Institutional', color: 'var(--accent-amber)' },
    'not_found': { label: '❌ Not Found', color: 'var(--accent-red)' },
};

export default function ContactsPanel({ contacts, emailsFound, emailsMissing }: ContactsPanelProps) {
    const copyEmail = (email: string) => {
        navigator.clipboard.writeText(email);
    };

    return (
        <div className="h-full flex flex-col">
            {/* Stats Bar */}
            <div className="px-5 py-3 border-b border-[var(--border-default)] flex items-center gap-4 bg-[var(--bg-secondary)]">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{contacts.length} contacts extracted</span>
                {emailsFound !== undefined && (
                    <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{emailsFound} emails found</span>
                )}
                {emailsMissing !== undefined && emailsMissing > 0 && (
                    <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{emailsMissing} missing</span>
                )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-secondary)] z-10">
                        <tr className="border-b border-[var(--border-default)]">
                            <th className="text-left px-5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Name</th>
                            <th className="text-left px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Email</th>
                            <th className="text-left px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Institution</th>
                            <th className="text-left px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Method</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)]">
                        {contacts.map((c, i) => {
                            const method = METHOD_BADGES[c.contact_method || 'not_found'] || METHOD_BADGES['not_found'];
                            return (
                                <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-5 py-3">
                                        <span className="font-semibold text-[var(--text-primary)]">{c.name}</span>
                                        {c.department && <span className="block text-[9px] text-[var(--text-muted)] mt-0.5">{c.department}</span>}
                                    </td>
                                    <td className="px-3 py-3">
                                        {c.email ? (
                                            <button
                                                onClick={() => copyEmail(c.email!)}
                                                className="text-[var(--accent-green)] hover:underline text-[10px] font-mono group flex items-center gap-1"
                                                title="Click to copy"
                                            >
                                                {c.email}
                                                <span className="opacity-0 group-hover:opacity-100 text-[8px] text-[var(--text-muted)]">📋</span>
                                            </button>
                                        ) : (
                                            <span className="text-[var(--text-muted)] text-[10px]">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-[var(--text-secondary)] text-[10px]">{c.institution || '—'}</td>
                                    <td className="px-3 py-3">
                                        <span className="text-[9px] font-semibold" style={{ color: method.color }}>{method.label}</span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
