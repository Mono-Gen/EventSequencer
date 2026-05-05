"use client";

import React, { useState, useEffect } from 'react';
import { FolderOpen, Save, Trash2, X, Plus, FileJson, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ProjectManagerProps {
  currentProjectName: string;
  onLoad: (name: string) => void;
  onSave: (name: string) => void;
  onClose: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ currentProjectName, onLoad, onSave, onClose }) => {
  const [projects, setProjects] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const fetchProjects = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/project');
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
        setStatus('idle');
      }
    } catch (err) {
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/project?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchProjects();
    } catch (err) {}
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0f0f0f] border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[600px] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
              <FolderOpen size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Project Manager</h2>
              <p className="text-xs text-zinc-500">Currently editing: <span className="text-blue-400 font-mono">{currentProjectName || 'Untitled'}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
            <X size={20} />
          </button>
        </div>

        {/* New Project Section */}
        <div className="p-6 bg-zinc-900/20 border-b border-zinc-800/50">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new project name..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all pl-10"
              />
              <Plus size={18} className="absolute left-3 top-3.5 text-zinc-600" />
            </div>
            <button 
              onClick={() => { if (newName) { onSave(newName); setNewName(""); fetchProjects(); } }}
              disabled={!newName}
              className="px-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
            >
              <Save size={18} /> SAVE NEW
            </button>
          </div>
        </div>

        {/* List Section */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">Saved Projects</h3>
          
          {projects.length === 0 && status === 'idle' && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4">
              <FileJson size={48} className="opacity-20" />
              <p className="text-sm">No projects found. Save your first project above.</p>
            </div>
          )}

          {projects.map(name => (
            <div 
              key={name}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all group
                ${name === currentProjectName ? 'bg-blue-500/5 border-blue-500/30' : 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/30'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${name === currentProjectName ? 'bg-blue-500 text-white shadow-lg' : 'bg-zinc-800 text-zinc-500'}`}>
                  <FileJson size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${name === currentProjectName ? 'text-white' : 'text-zinc-300'}`}>{name}</span>
                    {name === currentProjectName && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase tracking-tighter">Current</span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono uppercase">.json format</span>
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onLoad(name)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition-colors"
                >
                  LOAD
                </button>
                <button 
                  onClick={() => onSave(name)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[10px] font-bold transition-colors"
                >
                  OVERWRITE
                </button>
                <button 
                  onClick={() => handleDelete(name)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-center">
          <p className="text-[10px] text-zinc-600 flex items-center gap-2 uppercase tracking-widest font-bold">
            <AlertTriangle size={12} className="text-amber-500/50" /> Overwriting will replace existing data
          </p>
        </div>
      </div>
    </div>
  );
};
