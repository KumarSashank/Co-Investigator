'use client';

import { useState, useCallback } from 'react';
import ChatInterface from '@/components/ChatInterface';
import TaskTracker from '@/components/TaskTracker';
import ResearchBrief from '@/components/ResearchBrief';
import { DeepResearchPlan, PlanStep } from '@/types';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'chat' | 'brief'>('chat');

  // Session state — starts null, populated when user sends a query
  const [session, setSession] = useState<DeepResearchPlan | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  /**
   * Called by ChatInterface when the agent plan API returns successfully.
   */
  const handlePlanCreated = useCallback((planObj: DeepResearchPlan) => {
    setSession(planObj);
    // Auto-execute the plan steps sequentially
    executeAllTasks(planObj);
  }, []);

  /**
   * Sequentially executes each step in the plan via /api/agent/execute.
   */
  const executeAllTasks = async (currentSession: DeepResearchPlan) => {
    if (currentSession.awaiting_confirmation) return; // Prevent run if blocked

    setIsExecuting(true);
    let updatedSession = { ...currentSession };

    for (let i = 0; i < updatedSession.plan.length; i++) {
      const step = updatedSession.plan[i];
      if (step.status === 'DONE' || step.status === 'FAILED') continue; // Skip completed

      // Mark step as RUNNING
      updatedSession = {
        ...updatedSession,
        plan: updatedSession.plan.map(t =>
          t.id === step.id ? { ...t, status: 'RUNNING' as const } : t
        ),
        updatedAt: new Date().toISOString(),
      };
      setSession({ ...updatedSession });

      try {
        const res = await fetch('/api/agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: updatedSession.session_id,
            taskId: step.id,
          }),
        });

        if (!res.ok) {
          throw new Error(`Execute API returned ${res.status}: ${res.statusText}`);
        }

        const result = await res.json();

        if (result.status === 'hitl_paused') {
          // Agent requested a pause
          updatedSession = {
            ...updatedSession,
            awaiting_confirmation: true,
            checkpoint_question: result.question || "Do you want to proceed?",
            checkpoint_options: result.options || ["Yes", "No"],
            updatedAt: new Date().toISOString(),
          };
          setSession({ ...updatedSession });
          setIsExecuting(false);
          return; // Exit loop, wait for user input
        }

        // Mark step as DONE with artifact
        const artifactsMap = { ...updatedSession.artifacts };
        if (result.artifactUri) {
          artifactsMap[step.id] = result.artifactUri;
        }

        updatedSession = {
          ...updatedSession,
          plan: updatedSession.plan.map(t =>
            t.id === step.id
              ? { ...t, status: 'DONE' as const, result_data: result.result }
              : t
          ),
          artifacts: artifactsMap,
          updatedAt: new Date().toISOString(),
        };
        setSession({ ...updatedSession });

      } catch (err: any) {
        // Mark task as FAILED and STOP — don't silently continue
        console.error(`[Execute] ❌ Step ${step.id} failed:`, err.message || err);
        updatedSession = {
          ...updatedSession,
          plan: updatedSession.plan.map(t =>
            t.id === step.id ? { ...t, status: 'FAILED' as const, error: err.message || 'Unknown error' } : t
          ),
          updatedAt: new Date().toISOString(),
        };
        setSession({ ...updatedSession });
        setIsExecuting(false);
        return; // Stop execution on failure
      }
    }

    // Check if all tasks are now done
    const allDone = updatedSession.plan.every(t => t.status === 'DONE' || t.status === 'FAILED');
    if (allDone) {
      await generateReport(updatedSession);
    }

    setIsExecuting(false);
  };

  /**
   * Called when the user clicks an option on the HITL checkpoint.
   */
  const handleApproval = useCallback(async (approved: boolean, choice?: string, feedback?: string) => {
    if (!session) return;

    if (!approved) {
      // User cancelled
      setSession(prev => prev ? {
        ...prev,
        awaiting_confirmation: false,
        checkpoint_question: `Cancelled: ${feedback || 'User denied execution.'}`,
        checkpoint_options: [],
        updatedAt: new Date().toISOString()
      } : null);
      return;
    }

    // Unblock the session and find the step that was paused
    const updatedSession = {
      ...session,
      awaiting_confirmation: false,
      checkpoint_question: null,
      checkpoint_options: [],
      updatedAt: new Date().toISOString()
    };

    // Convert the step from RUNNING back to PENDING so the loop can start it smoothly, 
    // or we can pass the choice directly to the backend if we built API support for it.
    // For now, we inject the user's choice into the next step's inputs.
    const runningIdx = updatedSession.plan.findIndex(t => t.status === 'RUNNING');
    if (runningIdx !== -1) {
      updatedSession.plan[runningIdx].inputs.user_choice = choice;
      updatedSession.plan[runningIdx].inputs.user_feedback = feedback;
      updatedSession.plan[runningIdx].status = 'PENDING'; // Reset so loop catches it
    }

    setSession(updatedSession);
    executeAllTasks(updatedSession);

  }, [session]);

  /**
   * Generates the final research brief by calling /api/agent/report.
   */
  const generateReport = async (currentSession: DeepResearchPlan) => {
    try {
      const res = await fetch('/api/agent/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSession.session_id }),
      });
      const data = await res.json();

      setSession(prev => prev ? {
        ...prev,
        final_output: data.report,
        updatedAt: new Date().toISOString(),
      } : null);

      // Auto-switch to the brief tab
      setActiveTab('brief');
    } catch (err) {
      console.error('Report generation failed:', err);
    }
  };

  const displaySession = session;
  const displayStatus = displaySession?.awaiting_confirmation ? 'BLOCKED' : (isExecuting ? 'RUNNING' : (displaySession?.final_output ? 'DONE' : 'PENDING'));

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
            <span className="text-white text-sm font-bold">DR</span>
          </div>
          <div>
            <h1 className="text-sm font-bold gradient-text">DeepResearch</h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Agentic Verification Pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`badge badge-${displayStatus.toLowerCase()}`}>
            {displayStatus}
          </span>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-card)', color: 'var(--accent-blue)' }}>
            V
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
              💬 Agent Interface
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
              📋 Grounded Report
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
                  markdown={displaySession?.final_output || ''}
                  // Optional: Compute grounded score from Vertex AI response
                  groundingScore={0.99}
                />
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar */}
        <aside
          className="w-full md:w-[420px] shrink-0 flex flex-col overflow-y-auto p-5"
          style={{
            borderLeft: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
          }}
        >
          <h2 className="text-sm font-bold mb-4 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
            <span className="text-base">🧪</span>
            Execution Pipeline
          </h2>
          <TaskTracker session={displaySession} onApproval={handleApproval} isExecuting={isExecuting} />
        </aside>
      </div>
    </div>
  );
}
