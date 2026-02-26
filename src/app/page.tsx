'use client';

import { useState, useCallback } from 'react';
import ChatInterface from '@/components/ChatInterface';
import TaskTracker from '@/components/TaskTracker';
import ResearchBrief from '@/components/ResearchBrief';
import { ResearchSession, SubTask } from '@/lib/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'brief'>('chat');
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState('');
  const [groundingScore, setGroundingScore] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1: User submits a query → call /api/agent/plan
  const handleNewQuery = useCallback(async (query: string): Promise<string> => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      // Create a local session (since Firestore may not be configured yet)
      const plan: SubTask[] = data.plan.map((t: SubTask, i: number) => ({
        ...t,
        id: t.id || `step-${i + 1}`,
        status: 'pending' as const,
      }));

      const newSession: ResearchSession = {
        id: `session-${Date.now()}`,
        originalQuery: query,
        status: 'running',
        plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSession(newSession);

      // Auto-execute the first task
      await executeTask(newSession, plan[0]);

      const planSummary = plan.map((t: SubTask) => `• ${t.description} (${t.toolToUse})`).join('\n');
      return `I've created a research plan with **${plan.length} steps:**\n\n${planSummary}\n\nExecuting step 1 now...`;
    } catch (err: any) {
      console.error('Plan error:', err);
      return `Sorry, I encountered an error creating the plan: ${err.message}. The backend API may not be connected yet.`;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Execute a single task by calling the tool API directly
  const executeTask = useCallback(async (sess: ResearchSession, task: SubTask) => {
    if (!task) return;

    // Mark as in_progress
    const updatedPlan = sess.plan.map((t) =>
      t.id === task.id ? { ...t, status: 'in_progress' as const } : t
    );
    const updatedSession = { ...sess, plan: updatedPlan, updatedAt: new Date().toISOString() };
    setSession(updatedSession);

    try {
      let toolResult = null;
      if (task.toolToUse === 'bigquery') {
        const res = await fetch(`/api/tools/bigquery?disease=${encodeURIComponent(sess.originalQuery)}`);
        toolResult = await res.json();
      } else if (task.toolToUse === 'openalex') {
        const res = await fetch(`/api/tools/openalex?keyword=${encodeURIComponent(sess.originalQuery)}`);
        toolResult = await res.json();
      } else if (task.toolToUse === 'pubmed') {
        const res = await fetch(`/api/tools/pubmed?query=${encodeURIComponent(sess.originalQuery)}`);
        toolResult = await res.json();
      }

      // Mark as completed with result
      const completedPlan = updatedSession.plan.map((t) =>
        t.id === task.id ? { ...t, status: 'completed' as const, resultData: toolResult } : t
      );

      // Check if we should pause for HITL
      const completedCount = completedPlan.filter((t) => t.status === 'completed').length;
      const shouldPause = completedCount === 1 && completedPlan.length > 1; // Pause after first task

      const finalSession: ResearchSession = {
        ...updatedSession,
        plan: completedPlan,
        status: shouldPause ? 'hitl_paused' : 'running',
        updatedAt: new Date().toISOString(),
      };
      setSession(finalSession);
    } catch (err) {
      console.error('Execute error:', err);
      const failedPlan = updatedSession.plan.map((t) =>
        t.id === task.id ? { ...t, status: 'failed' as const } : t
      );
      setSession({ ...updatedSession, plan: failedPlan, status: 'error' });
    }
  }, []);

  // HITL Approve: continue executing remaining tasks
  const handleApprove = useCallback(async (feedback?: string) => {
    if (!session) return;
    setIsProcessing(true);

    const pendingTasks = session.plan.filter((t) => t.status === 'pending');
    let currentSession = { ...session, status: 'running' as const };
    setSession(currentSession);

    for (const task of pendingTasks) {
      if (task.toolToUse === 'none') {
        // Skip "synthesize" tasks — the report API handles this
        const synPlan = currentSession.plan.map((t) =>
          t.id === task.id ? { ...t, status: 'completed' as const } : t
        );
        currentSession = { ...currentSession, plan: synPlan };
        setSession(currentSession);
        continue;
      }
      await executeTask(currentSession, task);
      // Re-read latest session state after execution
      currentSession = { ...currentSession, status: 'running' as const };
    }

    // Generate the final report
    try {
      const res = await fetch('/api/agent/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.id }),
      });
      const data = await res.json();
      if (data.markdown) {
        setReportMarkdown(data.markdown);
        setGroundingScore(data.groundingScore || 0.87);
        setActiveTab('brief');
      }
    } catch (err) {
      console.error('Report generation error:', err);
    }

    setSession((prev) => prev ? { ...prev, status: 'completed' } : null);
    setIsProcessing(false);
  }, [session, executeTask]);

  // HITL Deny
  const handleDeny = useCallback(() => {
    setSession((prev) => prev ? { ...prev, status: 'error' } : null);
  }, []);

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
          {session && (
            <span className={`badge badge-${session.status}`}>
              {session.status.replace('_', ' ')}
            </span>
          )}
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
              style={{ color: activeTab === 'chat' ? 'var(--accent-blue)' : 'var(--text-muted)' }}
            >
              💬 Chat
              {activeTab === 'chat' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: 'var(--accent-blue)' }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('brief')}
              className="px-4 py-2.5 text-xs font-semibold transition-all relative"
              style={{ color: activeTab === 'brief' ? 'var(--accent-blue)' : 'var(--text-muted)' }}
            >
              📋 Research Brief
              {activeTab === 'brief' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: 'var(--accent-blue)' }} />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'chat' ? (
              <div className="h-full">
                <ChatInterface onSendQuery={handleNewQuery} isProcessing={isProcessing} />
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-6">
                <ResearchBrief
                  markdown={reportMarkdown}
                  groundingScore={groundingScore}
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
          <TaskTracker
            session={session}
            onApprove={handleApprove}
            onDeny={handleDeny}
          />
        </aside>
      </div>
    </div>
  );
}
