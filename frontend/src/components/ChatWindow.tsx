'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { useAuthStore } from '../store/authStore';

interface ChatWindowProps {
  expenseId: string;
}

export default function ChatWindow({ expenseId }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { messages, isConnected, isLoadingHistory, sendMessage } = useChat(expenseId);
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoadingHistory]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  return (
    <div className="bg-slate-900/15 border border-slate-850 rounded-3xl flex flex-col h-[480px] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-850 flex items-center justify-between bg-slate-900/40 shrink-0">
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">Expense Comments</h4>
          <p className="text-[10px] text-slate-500 mt-0.5">Real-time group discussion</p>
        </div>

        {/* Connection status badge */}
        <div className="flex items-center space-x-1.5">
          <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <span className="text-[10px] font-semibold text-slate-450 uppercase tracking-wider">
            {isConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 custom-scrollbar bg-slate-950/20">
        {isLoadingHistory ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`flex items-start gap-2 ${n % 2 === 0 ? 'justify-end' : ''}`}>
                <div className="h-8 w-8 rounded-full bg-slate-900 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-3 w-16 bg-slate-900 animate-pulse rounded" />
                  <div className="h-8 w-36 bg-slate-900 animate-pulse rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-505">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-xs font-semibold text-slate-400">No comments yet</p>
            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[180px]">Ask a question or clarify splits about this expense.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user.id === user?.id;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Bubble sender */}
                {!isMe && (
                  <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">
                    {msg.user.name}
                  </span>
                )}
                
                {/* Message bubble */}
                <div className="max-w-[85%] flex items-end gap-1.5">
                  {isMe && <span className="text-[9px] text-slate-650 mb-1">{timeStr}</span>}
                  
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm break-all ${
                      isMe
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-medium rounded-tr-none'
                        : 'bg-slate-900 border border-slate-850 text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {msg.message}
                  </div>

                  {!isMe && <span className="text-[9px] text-slate-650 mb-1">{timeStr}</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-850 bg-slate-900/30 flex gap-2 shrink-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isConnected ? "Write a comment..." : "Connecting to chat..."}
          disabled={!isConnected}
          className="flex-1 bg-slate-950 border border-slate-850 rounded-2xl py-2 px-4 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isConnected || !text.trim()}
          className="bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-slate-950 font-bold p-2.5 rounded-2xl transition shrink-0 flex items-center justify-center"
        >
          <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
