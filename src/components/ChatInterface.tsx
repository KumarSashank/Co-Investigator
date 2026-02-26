'use client';

import { useState } from 'react';

// Instruction to Frontend UI Developer (Cursor):
// 1. Build a beautiful, responsive chat interface.
// 2. Add an input box at the bottom.
// 3. When the user submits, call POST /api/agent/plan and update the TaskTracker state.
export default function ChatInterface() {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Hello! I am your Co-Investigator. What would you like to research today?' }
    ]);
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages([...messages, { role: 'user', text: input }]);
        setInput('');
        // TODO (Frontend Lead): Hook this up to fetch('/api/agent/plan', { method: 'POST', body: JSON.stringify({ query: input }) })
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`p-4 rounded-xl max-w-[80%] ${msg.role === 'user' ? 'bg-blue-600 text-white self-end ml-auto' : 'bg-white border text-gray-800 mr-auto'}`}>
                        {msg.text}
                    </div>
                ))}
            </div>

            <div className="p-4 bg-white border-t">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="e.g. Find researchers who have published on IPF in the last 3 years"
                        className="flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleSend}
                        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
