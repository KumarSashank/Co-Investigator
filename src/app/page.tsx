'use client';

import { useState, useCallback } from 'react';
import InvestigatorFeed from '@/components/InvestigatorFeed';
import DataPanelContainer from '@/components/DataPanelContainer';
import ResearchBrief from '@/components/ResearchBrief';
import SessionHistory from '@/components/SessionHistory';
import PlanReview from '@/components/PlanReview';
import { DeepResearchPlan, PlanStep } from '@/types';

type AppPhase = 'idle' | 'plan_review' | 'executing' | 'done';

export default function Home() {
  const [activeView, setActiveView] = useState<'desk' | 'report'>('desk');

  // Session state
  const [session, setSession] = useState<DeepResearchPlan | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  // Plan Review state
  const [planDraft, setPlanDraft] = useState<DeepResearchPlan | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  // Compute current phase
  const phase: AppPhase = planDraft ? 'plan_review'
    : isExecuting ? 'executing'
      : session?.final_output ? 'done'
        : session ? 'executing' // Has session but not executing = paused (HITL)
          : 'idle';

  /**
   * Called by InvestigatorFeed when the agent plan API returns.
   * Instead of executing immediately, show the plan for review.
   */
  const handlePlanCreated = useCallback((planObj: DeepResearchPlan) => {
    setPlanDraft(planObj);
  }, []);

  /**
   * User approved the plan — now execute.
   */
  const handlePlanApproved = useCallback((editedSteps: PlanStep[]) => {
    if (!planDraft) return;
    const approvedPlan = { ...planDraft, plan: editedSteps };
    setPlanDraft(null);
    setSession(approvedPlan);
    executeAllTasks(approvedPlan);
  }, [planDraft]);

  /**
   * User wants to refine the plan.
   */
  const handlePlanRefine = useCallback(async (feedback: string) => {
    if (!planDraft) return;
    setIsRefining(true);
    try {
      const res = await fetch('/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `${planDraft.user_request}\n\nUser feedback on previous plan: ${feedback}`
        }),
      });
      const data = await res.json();
      if (data.status === 'success' && data.plan) {
        setPlanDraft(data.plan);
      }
    } catch (err) {
      console.error('Refine failed:', err);
    }
    setIsRefining(false);
  }, [planDraft]);

  /**
   * Sequentially executes each step via /api/agent/execute.
   */
  const executeAllTasks = async (currentSession: DeepResearchPlan) => {
    if (currentSession.awaiting_confirmation) return;

    setIsExecuting(true);
    let updatedSession = { ...currentSession };

    for (let i = 0; i < updatedSession.plan.length; i++) {
      const step = updatedSession.plan[i];
      if (step.status === 'DONE' || step.status === 'FAILED') continue;

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

        if (!res.ok) throw new Error(`Execute API ${res.status}`);
        const result = await res.json();

        if (result.status === 'hitl_paused') {
          updatedSession = {
            ...updatedSession,
            awaiting_confirmation: true,
            checkpoint_question: result.question || "Do you want to proceed?",
            checkpoint_options: result.options || ["Yes", "No"],
            updatedAt: new Date().toISOString(),
          };
          setSession({ ...updatedSession });
          setIsExecuting(false);
          return;
        }

        const artifactsMap = { ...updatedSession.artifacts };
        if (result.artifactUri) artifactsMap[step.id] = result.artifactUri;

        updatedSession = {
          ...updatedSession,
          plan: updatedSession.plan.map(t =>
            t.id === step.id ? { ...t, status: 'DONE' as const, result_data: result.result } : t
          ),
          artifacts: artifactsMap,
          updatedAt: new Date().toISOString(),
        };
        setSession({ ...updatedSession });

      } catch (err: any) {
        updatedSession = {
          ...updatedSession,
          plan: updatedSession.plan.map(t =>
            t.id === step.id ? { ...t, status: 'FAILED' as const, error: err.message } : t
          ),
          updatedAt: new Date().toISOString(),
        };
        setSession({ ...updatedSession });
        setIsExecuting(false);
        return;
      }
    }

    setIsExecuting(false);
  };

  /**
   * HITL approval handler.
   */
  const handleApproval = useCallback(async (approved: boolean, choice?: string, feedback?: string) => {
    if (!session) return;

    if (!approved) {
      setSession(prev => prev ? {
        ...prev,
        awaiting_confirmation: false,
        checkpoint_question: `Cancelled: ${feedback || 'User denied.'}`,
        checkpoint_options: [],
        updatedAt: new Date().toISOString()
      } : null);
      return;
    }

    const updatedSession = {
      ...session,
      awaiting_confirmation: false,
      checkpoint_question: null,
      checkpoint_options: [],
      updatedAt: new Date().toISOString()
    };

    const runningIdx = updatedSession.plan.findIndex(t => t.status === 'RUNNING');
    if (runningIdx !== -1) {
      updatedSession.plan[runningIdx].status = 'DONE';
      updatedSession.plan[runningIdx].result_data = {
        user_choice: choice, user_feedback: feedback, approved_at: new Date().toISOString()
      };
    }

    setSession(updatedSession);
    executeAllTasks(updatedSession);
  }, [session]);

  /**
   * Generate report.
   */
  const handleGenerateReport = async () => {
    if (!session) return;
    setActiveView('report');
    try {
      const res = await fetch('/api/agent/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.session_id }),
      });
      const data = await res.json();
      setSession(prev => prev ? { ...prev, final_output: data.report, updatedAt: new Date().toISOString() } : null);
    } catch (err) {
      console.error('Report generation failed:', err);
    }
  };

  /**
   * Session history handlers.
   */
  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (loadingSession) return;
    setLoadingSession(true);
    setPlanDraft(null);
    try {
      const res = await fetch(`/api/agent/session?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      if (data.session) {
        setSession(data.session);
        setIsExecuting(false);
        setActiveView(data.session.final_output ? 'report' : 'desk');
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
    setLoadingSession(false);
  }, [loadingSession]);

  const handleNewSession = useCallback(() => {
    setSession(null);
    setPlanDraft(null);
    setIsExecuting(false);
    setActiveView('desk');
  }, []);

  const displayStatus = session?.awaiting_confirmation ? 'BLOCKED' : (isExecuting ? 'RUNNING' : (session?.final_output ? 'DONE' : (planDraft ? 'PLANNING' : 'PENDING')));

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 shrink-0 z-20" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-secondary)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))' }}>
            <span className="text-white text-sm font-bold">CI</span>
          </div>
          <div>
            <h1 className="text-sm font-bold gradient-text">Co-Investigator</h1>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pre-clinical Research Platform</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {session && (
            <div className="flex bg-[var(--bg-input)] rounded-lg p-1 border border-[var(--border-default)]">
              <button onClick={() => setActiveView('desk')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${activeView === 'desk' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}>
                Investigation
              </button>
              <button onClick={() => setActiveView('report')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${activeView === 'report' ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-muted)] hover:text-white'}`}>
                Report
              </button>
            </div>
          )}
          <span className={`badge badge-${displayStatus.toLowerCase()}`}>{displayStatus}</span>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Session History Sidebar */}
        <SessionHistory
          currentSessionId={session?.session_id}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Investigation Desk */}
        {activeView === 'desk' && (
          <>
            {/* Left: Conversation Feed */}
            <div className="w-[420px] shrink-0 h-full z-10">
              <InvestigatorFeed
                session={session}
                isExecuting={isExecuting}
                onPlanCreated={handlePlanCreated}
                onApproval={handleApproval}
                planDraft={planDraft}
                onPlanApproved={handlePlanApproved}
                onPlanRefine={handlePlanRefine}
                isRefining={isRefining}
              />
            </div>

            {/* Right: Dedicated Data Panels */}
            <main className="flex-1 overflow-hidden bg-[var(--bg-primary)] border-l border-[var(--border-default)]">
              <DataPanelContainer session={session} onGenerateReport={handleGenerateReport} />
            </main>
          </>
        )}

        {/* Report View */}
        {activeView === 'report' && (
          <main className="flex-1 overflow-y-auto p-8 bg-[var(--bg-primary)]">
            <div className="max-w-4xl mx-auto bg-[var(--bg-card)] rounded-xl border border-[var(--border-default)] shadow-2xl p-8 min-h-full">
              {!session?.final_output ? (
                <div className="h-full flex flex-col items-center justify-center p-20 animate-pulse">
                  <span className="text-4xl mb-4">✍️</span>
                  <p className="text-[var(--text-muted)]">Drafting synthesis report...</p>
                </div>
              ) : (
                <ResearchBrief markdown={session.final_output} groundingScore={0.99} />
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
