import React from 'react';
import { supabase } from '@cms/shared';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <span className="text-2xl font-bold text-indigo-400">⛪</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">New Church Client</h1>
          <p className="text-slate-400 text-sm">
            This workspace app is isolated with its own database connection and custom specifications.
          </p>
        </div>
        
        <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 text-left space-y-3 font-mono text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Workspace:</span>
            <span className="text-indigo-400 font-semibold">apps/new-church</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Sync Engine Status:</span>
            <span className="text-emerald-400 font-semibold">Shared Active</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Supabase Endpoint:</span>
            <span className="text-slate-400 truncate max-w-[180px]">
              {import.meta.env.VITE_SUPABASE_URL || 'Not Configured'}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <button 
            onClick={() => alert("Ready to customize workflows!")} 
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98]"
          >
            Start Customizing Workflows
          </button>
        </div>
      </div>
    </div>
  );
}
