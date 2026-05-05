"use client";

import React from 'react';
import { Event, CommandType, DeviceConfig, DataFormat, Terminator, RampEvent } from '@/lib/types';
import { X, Trash2, Clock, Cpu, Zap, Repeat, Hash, Type, CornerDownLeft, Play, MessageSquare, Power, PowerOff, Activity, Layers, Lock } from 'lucide-react';

interface InspectorProps {
  event: Event;
  devices: DeviceConfig[];
  onUpdate: (updatedEvent: Event) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
  onFire: (event: Event) => void;
  lastTally?: string;
  isFiring?: boolean;
  isLocked?: boolean;
  protocol?: string;
}

import { msToTimeStr, timeStrToMs } from '@/lib/timeUtils';

export const Inspector: React.FC<InspectorProps> = ({ 
  event, devices, onUpdate, onDelete, onClose, onFire, lastTally, isFiring, isLocked = false, protocol
}) => {
  const [localTime, setLocalTime] = React.useState(msToTimeStr(event.time));

  // Update local time when event changes externally
  React.useEffect(() => {
    setLocalTime(msToTimeStr(event.time));
  }, [event.time]);
  
  const asciiToHex = (str: string) => {
    return Array.from(str)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  };

  const hexToAscii = (hex: string) => {
    const bytes = hex.replace(/\s+/g, '').match(/.{1,2}/g) || [];
    return bytes
      .map(b => {
        const code = parseInt(b, 16);
        return (code >= 32 && code <= 126) ? String.fromCharCode(code) : '';
      })
      .join('');
  };

  const handleChange = (field: string, value: any) => {
    if (isLocked) return;
    onUpdate({ ...event, [field]: value } as Event);
  };

  const handleTimeBlur = () => {
    if (isLocked) return;
    const newMs = timeStrToMs(localTime);
    onUpdate({ ...event, time: newMs } as Event);
    // Reset local time to formatted version
    setLocalTime(msToTimeStr(newMs));
  };

  const handleTimeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTimeBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleFormatChange = (newFormat: DataFormat) => {
    if (isLocked || event.format === newFormat) return;
    
    let currentCommand = (event as any).command || '';
    let newCommand = currentCommand;

    if (newFormat === 'hex') {
      newCommand = asciiToHex(currentCommand);
    } else {
      newCommand = hexToAscii(currentCommand);
    }

    onUpdate({ ...event, format: newFormat, command: newCommand } as Event);
  };

  // Ramp Estimation Logic
  const getRampEstimation = () => {
    if (event.type !== 'ramp') return null;
    const re = event as RampEvent;
    
    const startVal = Number(re.startValue) || 0;
    const endVal = Number(re.endValue) || 0;
    const duration = Number(re.duration) || 1000;
    const mode = re.rampMode || 'smooth';
    const steps = Number(re.steps) || 10;
    
    const diff = Math.abs(endVal - startVal);
    
    if (mode === 'smooth') {
      const interval = diff > 0 ? Math.max(10, duration / diff) : duration;
      const packets = diff > 0 ? Math.min(diff + 1, Math.floor(duration / 10) + 1) : 1;
      return { interval: Math.round(interval), packets: Math.round(packets), isLimited: interval <= 10 };
    } else {
      const interval = Math.max(10, duration / steps);
      const packets = steps + 1;
      return { interval: Math.round(interval), packets: packets, isLimited: (duration / steps) < 10 };
    }
  };

  const estimation = getRampEstimation();
  
  const renderOSCHighlight = (text: string) => {
    if (!text) return null;
    const parts = text.trim().split(/\s+/);
    const address = parts[0];
    const args = parts.slice(1);

    return (
      <div className="flex flex-wrap gap-1 font-mono text-[11px] py-1">
        <span className="text-blue-400">{address}</span>
        {args.map((arg, i) => {
          const prefixMatch = arg.match(/^([ifds]):(.+)$/);
          if (prefixMatch) {
            const [, prefix, value] = prefixMatch;
            const colorClass = prefix === 'i' ? 'text-amber-400' : 
                               prefix === 'f' ? 'text-emerald-400' : 
                               prefix === 'd' ? 'text-cyan-400' : 
                               'text-pink-400';
            return (
              <span key={i} className="flex items-center">
                <span className="text-white font-bold text-[9px] mr-0.5 opacity-100">{prefix}:</span>
                <span className={colorClass}>{value}</span>
              </span>
            );
          }
          return (
            <span key={i} className={!isNaN(Number(arg)) ? "text-emerald-400" : "text-zinc-300"}>
              {arg}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`w-80 h-full bg-[#0f0f0f] border-l ${isLocked ? 'border-orange-500/50' : 'border-zinc-800'} flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 relative`}>
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Zap size={14} className={isLocked ? 'text-orange-500' : 'text-blue-500'} /> 
          Event Inspector
          {isLocked && <span className="ml-2 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[8px] text-orange-500 flex items-center gap-1"><Lock size={8} /> LOCKED</span>}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500">
          <X size={16} />
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 space-y-8 transition-all ${isLocked ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Time & Location</label>
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400 flex items-center gap-2"><Clock size={12} /> Execution Time (HH:MM:SS.mmm)</span>
            <input 
              type="text"
              readOnly={isLocked}
              value={localTime}
              onChange={(e) => setLocalTime(e.target.value)}
              onBlur={handleTimeBlur}
              onKeyDown={handleTimeKeyDown}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
              placeholder="00:00:00.000"
            />
          </div>
        </div>

        {protocol !== 'osc' && (
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Protocol & Format</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400 flex items-center gap-2"><Hash size={12} /> Data Format</span>
                <div className="flex p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                  {(['ascii', 'hex'] as DataFormat[]).map(f => (
                    <button key={f} disabled={isLocked} onClick={() => handleFormatChange(f)} className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${event.format === f ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400 flex items-center gap-2"><CornerDownLeft size={12} /> Terminator</span>
                <select disabled={isLocked} value={event.terminator || 'none'} onChange={(e) => handleChange('terminator', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] focus:outline-none">
                  <option value="none">NONE</option><option value="cr">CR (\r)</option><option value="lf">LF (\n)</option><option value="crlf">CR+LF</option>
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Command Configuration</label>
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400 flex items-center gap-2"><Repeat size={12} /> Event Type</span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
              {(['trigger', 'on', 'off', 'ramp'] as CommandType[]).map(t => (
                <button
                  key={t}
                  disabled={isLocked}
                  onClick={() => {
                    const newEvent = { ...event, type: t } as any;
                    if (t === 'on' && !newEvent.command) newEvent.command = newEvent.commandOn || '';
                    if (t === 'off' && !newEvent.command) newEvent.command = newEvent.commandOff || '';
                    if (t === 'ramp') {
                      if (newEvent.startValue === undefined) newEvent.startValue = 0;
                      if (newEvent.endValue === undefined) newEvent.endValue = 100;
                      if (newEvent.duration === undefined) newEvent.duration = 1000;
                      if (newEvent.rampMode === undefined) newEvent.rampMode = 'smooth';
                      if (newEvent.steps === undefined) newEvent.steps = 10;
                      if (!newEvent.commandTemplate) newEvent.commandTemplate = 'VOL {value}';
                    }
                    onUpdate(newEvent);
                  }}
                  className={`py-1.5 rounded-md text-[9px] font-bold uppercase transition-all ${event.type === t ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {(event.type === 'trigger' || event.type === 'on' || event.type === 'off') && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400">Command Data {event.format === 'hex' ? '(HEX)' : '(ASCII)'}</span>
                <textarea readOnly={isLocked} value={(event as any).command || ''} onChange={(e) => handleChange('command', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono min-h-[80px] focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all" placeholder={event.format === 'hex' ? "F0 01 7F ..." : "Enter command..."} />
                {protocol === 'osc' && event.format !== 'hex' && (
                  <div className="mt-1 px-2 py-1 rounded bg-black/40 border border-zinc-800/50">
                    <div className="text-[8px] text-zinc-600 font-black uppercase mb-1">OSC Preview</div>
                    {renderOSCHighlight((event as any).command || '')}
                  </div>
                )}
              </div>
              <button onClick={() => onFire(event)} disabled={isFiring || isLocked} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all border ${isFiring ? 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse' : (event.type === 'on' ? 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : event.type === 'off' ? 'bg-zinc-700 border-zinc-600 hover:bg-zinc-600' : 'bg-blue-600 border-blue-500 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.3)]') + ' text-white hover:scale-[0.98] active:scale-95'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {isFiring ? <Zap size={14} className="animate-spin" /> : event.type === 'on' ? <Power size={14} /> : event.type === 'off' ? <PowerOff size={14} /> : <Play size={14} fill="currentColor" />}
                Fire {event.type.toUpperCase()}
              </button>
            </div>
          )}

          {event.type === 'ramp' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400 flex items-center gap-2"><Activity size={12} /> Interpolation Mode</span>
                <div className="flex p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                  <button disabled={isLocked} onClick={() => handleChange('rampMode', 'smooth')} className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${(event as RampEvent).rampMode === 'smooth' ? 'bg-blue-600 text-white' : 'text-zinc-500'}`}>Smooth</button>
                  <button disabled={isLocked} onClick={() => handleChange('rampMode', 'stepped')} className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${(event as RampEvent).rampMode === 'stepped' ? 'bg-amber-600 text-white' : 'text-zinc-500'}`}>Stepped</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><span className="text-[11px] text-zinc-400">Start Value</span><input type="number" readOnly={isLocked} value={(event as any).startValue ?? 0} onChange={(e) => handleChange('startValue', parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono" /></div>
                <div className="space-y-1.5"><span className="text-[11px] text-zinc-400">End Value</span><input type="number" readOnly={isLocked} value={(event as any).endValue ?? 0} onChange={(e) => handleChange('endValue', parseFloat(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono" /></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><span className="text-[11px] text-zinc-400">Duration (ms)</span><input type="number" readOnly={isLocked} value={(event as any).duration ?? 0} onChange={(e) => handleChange('duration', parseInt(e.target.value) || 0)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono" /></div>
                <div className="space-y-1.5 opacity-100 transition-opacity">
                  <span className="text-[11px] text-zinc-400">{(event as RampEvent).rampMode === 'smooth' ? 'Min Step (fixed)' : 'Steps Count'}</span>
                  <input type="number" readOnly={isLocked} value={(event as RampEvent).rampMode === 'smooth' ? 10 : (event as any).steps ?? 10} disabled={(event as RampEvent).rampMode === 'smooth' || isLocked} onChange={(e) => handleChange('steps', parseInt(e.target.value) || 0)} className={`w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono ${((event as RampEvent).rampMode === 'smooth' || isLocked) ? 'opacity-50' : ''}`} />
                </div>
              </div>

              {estimation && (
                <div className={`p-3 rounded-lg border flex items-center justify-between animate-in zoom-in-95 duration-200
                  ${estimation.isLimited ? 'bg-amber-500/5 border-amber-500/20' : 'bg-blue-500/5 border-blue-500/20'}`}>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight flex items-center gap-1.5">
                      <Layers size={12} /> Est. Packets: <span className="text-zinc-200 font-mono">{estimation.packets}</span>
                    </p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight flex items-center gap-1.5">
                      <Activity size={12} /> Interval: <span className="text-zinc-200 font-mono">{estimation.interval}ms</span>
                    </p>
                  </div>
                  {estimation.isLimited && (
                    <div className="px-2 py-1 rounded bg-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-tighter ring-1 ring-amber-500/30">
                      10ms Limit
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400">Template</span>
                <input readOnly={isLocked} value={(event as any).commandTemplate || ''} onChange={(e) => handleChange('commandTemplate', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm font-mono" placeholder="VOL {value}" />
                {protocol === 'osc' && (
                  <div className="mt-1 px-2 py-1 rounded bg-black/40 border border-zinc-800/50">
                    <div className="text-[8px] text-zinc-600 font-black uppercase mb-1">OSC Preview</div>
                    {renderOSCHighlight(((event as any).commandTemplate || '').replace('{value}', '100'))}
                  </div>
                )}
              </div>
              
              <button onClick={() => onFire(event)} disabled={isFiring || isLocked} className={`w-full py-3 rounded-xl bg-amber-600 text-white border border-amber-500 font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 transition-all flex items-center justify-center gap-2 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Zap size={14} /> Preview Ramp
              </button>
            </div>
          )}

          {lastTally && (
            <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 space-y-1 animate-in fade-in duration-500">
              <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-wider"><MessageSquare size={12} /> Last Tally / Response</div>
              <p className="text-[11px] font-mono text-emerald-400 break-all leading-relaxed">{lastTally}</p>
            </div>
          )}
        </div>
      </div>

      <div className={`p-6 border-t border-zinc-800 bg-zinc-900/10 ${isLocked ? 'hidden' : ''}`}>
        <button onClick={() => onDelete(event.id)} className="w-full h-11 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 font-bold text-xs"><Trash2 size={14} /> DELETE EVENT</button>
      </div>
      {isLocked && (
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/10 flex items-center justify-center gap-2 text-zinc-500 italic text-[10px]">
          <Lock size={12} /> Editing is locked in this mode
        </div>
      )}
    </div>
  );
};
