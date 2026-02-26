'use client';

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import TaskTracker from '@/components/TaskTracker';
import ResearchBrief from '@/components/ResearchBrief';
import { MOCK_SESSION } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'brief'>('chat');
  const session = MOCK_SESSION;

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Top Header Bar */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))' }}>
            <span className="text-white text-sm font-bold">CI</span>
          </div>
          <div>
            <h1 className="text-sm font-bold gradient-text">Co-Investigator</h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              BenchSpark AI Research Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`badge badge-${session.status}`}>
            {session.status.replace('_', ' ')}
          </span>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-card)', color: 'var(--accent-blue)' }}>
            P
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {/* Left: Chat + Brief Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Switcher */}
          <div
            className="flex gap-0 px-6 pt-3 shrink-0"
            style={{ borderBottom: '1px solid var(--border-default)' }}
          >
            <button
              onClick={() => setActiveTab('chat')}
              className="px-4 py-2.5 text-xs font-semibold transition-all relative"
              style={{
                color: activeTab === 'chat' ? 'var(--accent-blue)' : 'var(--text-muted)',
              }}
            >
              💬 Chat
              {activeTab === 'chat' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: 'var(--accent-blue)' }}
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('brief')}
              className="px-4 py-2.5 text-xs font-semibold transition-all relative"
              style={{
                color: activeTab === 'brief' ? 'var(--accent-blue)' : 'var(--text-muted)',
              }}
            >
              📋 Research Brief
              {activeTab === 'brief' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: 'var(--accent-blue)' }}
                />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' ? (
              <div className="h-full">
                <ChatInterface />
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-6">
                <ResearchBrief
                  markdown={session.finalReportMarkdown || ''}
                  groundingScore={0.87}
                />
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside
          className="w-full md:w-[380px] shrink-0 flex flex-col overflow-y-auto p-5"
          style={{
            borderLeft: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
          }}
        >
          <h2 className="text-sm font-bold mb-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            <span className="text-base">🧪</span>
            Investigation Plan
          </h2>
          <TaskTracker />
        </aside>
      </div>
    </div>
  );
}
