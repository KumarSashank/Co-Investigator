import ChatInterface from '@/components/ChatInterface';
import TaskTracker from '@/components/TaskTracker';

export default function Home() {
  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row">
      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col p-4 md:p-8 overflow-hidden">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Co-Investigator</h1>
          <p className="text-gray-500">BenchSpark AI Research Assistant</p>
        </header>

        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <ChatInterface />
        </div>
      </main>

      {/* Right Sidebar for Task Tracking and State */}
      <aside className="w-full md:w-1/3 max-w-md bg-white border-l border-gray-200 p-6 flex flex-col overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Investigation Plan</h2>
        <TaskTracker />
      </aside>
    </div>
  );
}
