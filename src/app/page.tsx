'use client';

import { useState, useCallback } from 'react';
import ChatInterface from '@/components/ChatInterface';
import TaskTracker from '@/components/TaskTracker';
import ResearchBrief from '@/components/ResearchBrief';
import { ResearchSession, SubTask, MOCK_SESSION } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'brief'>('chat');

  // Session state — starts null, populated when user sends a query
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  /**
   * Called by ChatInterface when the agent plan API returns successfully.
   * Creates a local session object and kicks off execution.
   */
  const handlePlanCreated = useCallback((plan: SubTask[], sessionId: string, query: string) => {
    const newSession: ResearchSession = {
      id: sessionId,
      originalQuery: query,
      status: 'running',
      plan: plan.map(t => ({ ...t, status: t.status || 'pending' as const })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSession(newSession);
    // Auto-execute the plan steps sequentially
    executeAllTasks(newSession);
  }, []);

  /**
   * Sequentially executes each subtask in the plan via /api/agent/execute.
   */
  const executeAllTasks = async (currentSession: ResearchSession) => {
    setIsExecuting(true);
    let updatedSession = { ...currentSession };

    for (const task of updatedSession.plan) {
      // Mark task as in_progress
      updatedSession = {
        ...updatedSession,
        plan: updatedSession.plan.map(t =>
          t.id === task.id ? { ...t, status: 'in_progress' as const } : t
        ),
        updatedAt: new Date().toISOString(),
      };
      setSession({ ...updatedSession });

      try {
        const res = await fetch('/api/agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: updatedSession.id,
            taskId: task.id,
          }),
        });
        const result = await res.json();

        // Mark task as completed with results
        updatedSession = {
          ...updatedSession,
          plan: updatedSession.plan.map(t =>
            t.id === task.id
              ? { ...t, status: 'completed' as const, resultData: result.result }
              : t
          ),
          status: 'hitl_paused',
          updatedAt: new Date().toISOString(),
        };
      } catch (err) {
        // Mark task as failed
        updatedSession = {
          ...updatedSession,
          plan: updatedSession.plan.map(t =>
            t.id === task.id ? { ...t, status: 'failed' as const } : t
          ),
          updatedAt: new Date().toISOString(),
        };
      }
      setSession({ ...updatedSession });

      // Pause after each task for HITL review (user must approve to continue)
      break; // Stop after first task — HITL checkpoint
    }
    setIsExecuting(false);
  };

  /**
   * Called when the user clicks Approve on the HITL checkpoint.
   * Resumes execution of the remaining pending tasks.
   */
  const handleApproval = useCallback(async (approved: boolean, feedback?: string) => {
    if (!session) return;

    if (!approved) {
      setSession(prev => prev ? { ...prev, status: 'error', updatedAt: new Date().toISOString() } : null);
      return;
    }

    // Find the next pending task and continue execution
    const nextPendingIdx = session.plan.findIndex(t => t.status === 'pending');
    if (nextPendingIdx === -1) {
      // All tasks done — generate report
      await generateReport(session);
      return;
    }

    // Continue with remaining tasks
    const updatedSession = { ...session, status: 'running' as const, updatedAt: new Date().toISOString() };
    setSession(updatedSession);

    setIsExecuting(true);
    let runningSession: ResearchSession = { ...updatedSession };

    for (let i = nextPendingIdx; i < runningSession.plan.length; i++) {
      const task = runningSession.plan[i];
      if (task.status !== 'pending') continue;

      // Mark as in_progress
      runningSession = {
        ...runningSession,
        plan: runningSession.plan.map(t =>
          t.id === task.id ? { ...t, status: 'in_progress' as const } : t
        ),
        updatedAt: new Date().toISOString(),
      };
      setSession({ ...runningSession });

      try {
        const res = await fetch('/api/agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: runningSession.id, taskId: task.id }),
        });
        const result = await res.json();

        runningSession = {
          ...runningSession,
          plan: runningSession.plan.map(t =>
            t.id === task.id
              ? { ...t, status: 'completed' as const, resultData: result.result }
              : t
          ),
          status: 'hitl_paused' as const,
          updatedAt: new Date().toISOString(),
        };
      } catch (err) {
        runningSession = {
          ...runningSession,
          plan: runningSession.plan.map(t =>
            t.id === task.id ? { ...t, status: 'failed' as const } : t
          ),
          updatedAt: new Date().toISOString(),
        };
      }
      setSession({ ...runningSession });
      break; // Pause after each task for HITL
    }

    // Check if all tasks are now done
    const allDone = runningSession.plan.every(t => t.status === 'completed' || t.status === 'failed');
    if (allDone) {
      await generateReport(runningSession);
    }

    setIsExecuting(false);
  }, [session]);

  /**
   * Generates the final research brief by calling /api/agent/report.
   */
  const generateReport = async (currentSession: ResearchSession) => {
    try {
      const res = await fetch('/api/agent/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.id }),
      });
      const data = await res.json();

      setSession(prev => prev ? {
        ...prev,
        status: 'completed',
        finalReportMarkdown: data.markdown,
        updatedAt: new Date().toISOString(),
      } : null);

      // Auto-switch to the brief tab
      setActiveTab('brief');
    } catch (err) {
      console.error('Report generation failed:', err);
    }
  };

  // Use the real session for display, or show a default empty state
  const displaySession = session;
  const displayStatus = displaySession?.status || 'planning';

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
          <span className={`badge badge-${displayStatus}`}>
            {displayStatus.replace('_', ' ')}
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
                <ChatInterface onPlanCreated={handlePlanCreated} />
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-6">
                <ResearchBrief
                  markdown={displaySession?.finalReportMarkdown || ''}
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
          <TaskTracker session={displaySession} onApproval={handleApproval} isExecuting={isExecuting} />
        </aside>
      </div>
    </div>
  );
}
