'use client';

import { useState, useEffect } from 'react';
import { DeepResearchPlan } from '@/types';
import TargetsPanel from './panels/TargetsPanel';
import ResearchersPanel from './panels/ResearchersPanel';
import LiteraturePanel from './panels/LiteraturePanel';
import ContactsPanel from './panels/ContactsPanel';
import SynthesisPanel from './panels/SynthesisPanel';

interface DataPanelContainerProps {
    session: DeepResearchPlan | null;
    onGenerateReport: () => void;
}

interface TabDef {
    id: string;
    icon: string;
    label: string;
    count: number;
}

export default function DataPanelContainer({ session, onGenerateReport }: DataPanelContainerProps) {
    const [activeTab, setActiveTab] = useState<string | null>(null);

    // Dynamically compute which tabs should exist based on completed step data
    const tabs = computeTabs(session);

    // Auto-select first tab when tabs appear for the first time
    useEffect(() => {
        if (tabs.length > 0 && !activeTab) {
            setActiveTab(tabs[0].id);
        }
        // If active tab no longer exists in tabs, reset
        if (activeTab && !tabs.find(t => t.id === activeTab) && tabs.length > 0) {
            setActiveTab(tabs[0].id);
        }
    }, [tabs, activeTab]);

    const allDone = session?.plan.every(s => s.status === 'DONE' || s.status === 'FAILED');

    if (!session) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <div className="relative z-10">
                    <div className="text-4xl mb-5 opacity-25">🧬</div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Evidence Panels</h3>
                    <p className="text-xs text-[var(--text-muted)] max-w-xs leading-relaxed">
                        Dedicated panels for Targets, Researchers, Literature, and more will appear here as agents discover evidence.
                    </p>
                </div>
            </div>
        );
    }

    if (tabs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mb-4" />
                <p className="text-xs text-[var(--text-primary)]">Waiting for agent results...</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">Panels will appear as data arrives</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Tab Bar */}
            <div className="flex items-center border-b border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 shrink-0">
                <div className="flex gap-0 flex-1 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-3 text-[11px] font-semibold transition-all relative whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? 'text-[var(--accent-blue)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                            <span className="text-[8px] font-mono bg-black/20 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[var(--accent-blue)]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Generate Report Button */}
                {allDone && (
                    <button
                        onClick={onGenerateReport}
                        className="ml-2 shrink-0 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center gap-1.5"
                    >
                        📝 Generate Report
                    </button>
                )}
            </div>

            {/* Active Panel Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab && renderPanel(activeTab, session)}
            </div>
        </div>
    );
}


function computeTabs(session: DeepResearchPlan | null): TabDef[] {
    if (!session) return [];
    const tabs: TabDef[] = [];

    for (const step of session.plan) {
        if (step.status !== 'DONE' || !step.result_data?.ai_analysis) continue;
        const analysis = step.result_data.ai_analysis;

        // Targets
        if (analysis.key_targets?.length && !tabs.find(t => t.id === 'targets')) {
            tabs.push({ id: 'targets', icon: '🎯', label: 'Targets', count: analysis.key_targets.length });
        }

        // Researchers (from rank or verify agents)
        if ((analysis.ranked_researchers?.length || analysis.verified_profiles?.length) && !tabs.find(t => t.id === 'researchers')) {
            const count = analysis.ranked_researchers?.length || analysis.verified_profiles?.length || 0;
            tabs.push({ id: 'researchers', icon: '👥', label: 'Researchers', count });
        }

        // Literature (from chainable_data)
        const chainable = step.result_data.chainable_data;
        if (chainable?.pubmed_fetch?.length && !tabs.find(t => t.id === 'literature')) {
            tabs.push({ id: 'literature', icon: '📑', label: 'Literature', count: chainable.pubmed_fetch.length });
        }

        // Contacts
        if (analysis.contacts?.length && !tabs.find(t => t.id === 'contacts')) {
            tabs.push({ id: 'contacts', icon: '📧', label: 'Contacts', count: analysis.contacts.length });
        }

        // Synthesis
        if (analysis.target_researcher_map?.length && !tabs.find(t => t.id === 'synthesis')) {
            tabs.push({ id: 'synthesis', icon: '🧬', label: 'Synthesis', count: analysis.target_researcher_map.length });
        }
    }

    return tabs;
}


function renderPanel(tabId: string, session: DeepResearchPlan) {
    // Collect all data across completed steps for this panel type
    for (const step of session.plan) {
        if (step.status !== 'DONE' || !step.result_data?.ai_analysis) continue;
        const analysis = step.result_data.ai_analysis;
        const chainable = step.result_data.chainable_data;

        switch (tabId) {
            case 'targets':
                if (analysis.key_targets?.length) {
                    return <TargetsPanel targets={analysis.key_targets} diseaseSummary={analysis.disease_summary} />;
                }
                break;
            case 'researchers':
                if (analysis.ranked_researchers?.length || analysis.verified_profiles?.length) {
                    // Merge rank + verify data
                    const researchers = analysis.ranked_researchers || analysis.verified_profiles || [];
                    return <ResearchersPanel researchers={researchers} topPicks={analysis.top_3_collaborator_picks} fieldTrend={analysis.field_trend} />;
                }
                break;
            case 'literature':
                if (chainable?.pubmed_fetch?.length) {
                    return <LiteraturePanel papers={chainable.pubmed_fetch} />;
                }
                break;
            case 'contacts':
                if (analysis.contacts?.length) {
                    return <ContactsPanel contacts={analysis.contacts} emailsFound={analysis.emails_found} emailsMissing={analysis.emails_missing} />;
                }
                break;
            case 'synthesis':
                if (analysis.target_researcher_map?.length) {
                    return <SynthesisPanel mappings={analysis.target_researcher_map} keyInsight={analysis.key_insight} gaps={analysis.gaps_identified} />;
                }
                break;
        }
    }

    return (
        <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-xs">
            No data available for this panel yet.
        </div>
    );
}
