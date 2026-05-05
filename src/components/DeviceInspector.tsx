"use client";

import React from 'react';
import { DeviceConfig, Protocol, TrackConfig } from '@/lib/types';
import { X, Trash2, Cpu, Globe, Server, Hash, Palette, List, Lock } from 'lucide-react';

interface DeviceInspectorProps {
  device: DeviceConfig;
  tracks: TrackConfig[];
  onUpdate: (updatedDevice: DeviceConfig) => void;
  onUpdateTrack: (updatedTrack: TrackConfig) => void;
  onDelete: (deviceId: string) => void;
  onClose: () => void;
  isLocked?: boolean;
}

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Zinc', value: '#71717a' },
];

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({ device, tracks, onUpdate, onUpdateTrack, onDelete, onClose, isLocked = false }) => {
  const handleChange = (field: string, value: any) => {
    if (isLocked) return;
    onUpdate({ ...device, [field]: value } as DeviceConfig);
  };

  return (
    <div className={`w-80 h-full bg-[#0f0f0f] border-l ${isLocked ? 'border-orange-500/50' : 'border-zinc-800'} flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 relative`}>
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Cpu size={14} style={{ color: isLocked ? '#f97316' : (device.color || '#10b981') }} /> 
          Device Settings
          {isLocked && <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[8px] text-orange-500 flex items-center gap-1"><Lock size={8} /> LOCKED</span>}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500">
          <X size={16} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 space-y-8 transition-all ${isLocked ? 'pointer-events-none opacity-50' : ''}`}>
        {/* Appearance Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest flex items-center gap-2"><Palette size={12} /> Theme Color</label>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c.value}
                disabled={isLocked}
                onClick={() => handleChange('color', c.value)}
                className={`w-6 h-6 rounded-full transition-all border-2 ${device.color === c.value ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Network Info */}
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Network Configuration</label>
          
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400 flex items-center gap-2"><Globe size={12} /> IP Address</span>
            <input 
              type="text"
              readOnly={isLocked}
              value={device.ip}
              onChange={(e) => handleChange('ip', e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400 flex items-center gap-2"><Hash size={12} /> Port</span>
              <input 
                type="number"
                readOnly={isLocked}
                value={device.port}
                onChange={(e) => handleChange('port', parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-400 flex items-center gap-2"><Server size={12} /> Protocol</span>
              <div className="flex p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg h-[38px]">
                {(['tcp', 'udp'] as Protocol[]).map(p => (
                  <button
                    key={p}
                    disabled={isLocked}
                    onClick={() => handleChange('protocol', p)}
                    className={`flex-1 rounded-md text-[10px] font-bold uppercase transition-all
                      ${device.protocol === p ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-[9px] text-zinc-600 italic leading-relaxed pt-4">
          * Device and Track names can be edited directly in the sidebar for better workflow.
        </p>
      </div>

      <div className={`p-6 border-t border-zinc-800 bg-zinc-900/10 ${isLocked ? 'hidden' : ''}`}>
        <button 
          onClick={() => onDelete(device.id)}
          className="w-full h-11 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 font-bold text-xs"
        >
          <Trash2 size={14} /> REMOVE DEVICE
        </button>
      </div>
      {isLocked && (
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/10 flex items-center justify-center gap-2 text-zinc-500 italic text-[10px]">
          <Lock size={12} /> Settings are locked in this mode
        </div>
      )}
    </div>
  );
};
