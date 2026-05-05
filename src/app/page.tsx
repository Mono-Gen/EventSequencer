"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from '@/components/Timeline';
import { Inspector } from '@/components/Inspector';
import { DeviceInspector } from '@/components/DeviceInspector';
import { ProjectManager } from '@/components/ProjectManager';
import { Event, DeviceConfig, TrackConfig, RampEvent } from '@/lib/types';
import { 
  Play, Square, Settings, Activity, Clock, Layout, 
  List, Globe, ZoomIn, ZoomOut, RotateCcw, ShieldCheck, Target,
  Save, CheckCircle, Download, FolderSearch, AlertCircle, RefreshCw,
  Pause, SkipBack, Repeat, X, Lock, Unlock
} from 'lucide-react';

// --- Constants & Helpers ---
const DEFAULT_ZOOM = 100; // 100% = 100px/sec
const MAX_ZOOM = 5000;
const MIN_ZOOM = 0.01; // Can view 24h in ~900px
const ENGINE_TICK_MS = 10;
const NTP_INITIAL_SYNC_INTERVAL = 10000;
const NTP_MAX_SYNC_INTERVAL = 300000; // 5 minutes
const NTP_SYNC_INTERVAL_MS = 10000;
const PING_INTERVAL_MS = 1000;
const STORAGE_KEY_LAST_PROJECT = 'sequencer_last_project';

import { msToTimeStr, timeStrToMs } from '@/lib/timeUtils';

const generateId = (prefix: string = '') => 
  `${prefix}${Math.random().toString(36).substr(2, 9)}`;

interface ActiveRamp {
  id: string;
  eventId: string;
  realStartTime: number; 
  duration: number;
  startValue: string | number;
  endValue: string | number;
  rampMode: 'smooth' | 'stepped';
  steps: number; 
  template: string;
  deviceId: string;
  format: 'ascii' | 'hex';
  terminator: any;
  lastValue?: string | number;
}

export default function Home() {
  // State: Core Data
  const [projectName, setProjectName] = useState<string>("default");
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [tracks, setTracks] = useState<TrackConfig[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  // Refs for Engine
  const devicesRef = useRef(devices);
  const tracksRef = useRef(tracks);
  const eventsRef = useRef(events);
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // State: UI & Status
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<'realtime' | 'relative'>('relative');
  const [zoom, setZoom] = useState(DEFAULT_ZOOM); 
  const [isChasing, setIsChasing] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [collapsedDeviceIds, setCollapsedDeviceIds] = useState<Set<string>>(new Set());
  const [deviceStatus, setDeviceStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [eventStatus, setEventStatus] = useState<Record<string, { status: 'firing' | 'success' | 'error', message?: string }>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'loading' | 'loaded'>('idle');
  const [isLocked, setIsLocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State: Playback Extensions
  const [loopRange, setLoopRange] = useState<{ start: number, end: number } | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const loopRangeRef = useRef(loopRange);
  const isLoopingRef = useRef(isLooping);
  useEffect(() => { loopRangeRef.current = loopRange; }, [loopRange]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

  const [timeSource, setTimeSource] = useState<'os' | 'ntp'>('os');
  const [ntpServer, setNtpServer] = useState('pool.ntp.org');
  const [timeOffset, setTimeOffset] = useState(0); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentNtpInterval, setCurrentNtpInterval] = useState(NTP_INITIAL_SYNC_INTERVAL);
  const ntpTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [activeRamps, setActiveRamps] = useState<ActiveRamp[]>([]);
  const activeRampsRef = useRef(activeRamps);
  useEffect(() => { activeRampsRef.current = activeRamps; }, [activeRamps]);

  const lastFiredTime = useRef<number>(0);
  const selectedEvent = events.find(e => e.id === selectedEventId);
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editingTime, setEditingTime] = useState('');

  // --- Persistence ---
  const handleLoadProject = async (name: string, isQuick: boolean = false) => {
    setSaveStatus('loading');
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/project?name=${encodeURIComponent(name)}`);
      const result = await res.json();
      if (result.success && result.data) {
        setProjectName(name);
        localStorage.setItem(STORAGE_KEY_LAST_PROJECT, name);
        setDevices(result.data.devices || []);
        setTracks(result.data.tracks || []);
        setEvents(result.data.events || []);
        setLoopRange(result.data.loopRange || null);
        setIsLooping(result.data.isLooping || false);
        setSaveStatus(isQuick ? 'loaded' : 'idle');
        if (isQuick) setTimeout(() => setSaveStatus('idle'), 2000);
        setShowProjectManager(false);
      } else { setSaveStatus('idle'); }
    } catch (err) { 
      setSaveStatus('error');
      setErrorMessage(`Failed to load project: ${name}`);
    }
  };

  const handleSaveProject = async (name: string) => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: { devices, tracks, events, loopRange, isLooping } }),
      });
      const result = await res.json();
      if (result.success) {
        setProjectName(name);
        localStorage.setItem(STORAGE_KEY_LAST_PROJECT, name);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else { 
        setSaveStatus('error'); 
        setErrorMessage(result.error || 'Unknown save error');
      }
    } catch (err) { setSaveStatus('error'); setErrorMessage('Network error during save'); }
  };

  useEffect(() => {
    const lastProject = localStorage.getItem(STORAGE_KEY_LAST_PROJECT) || 'default';
    handleLoadProject(lastProject);

    // --- Remote Control Listener (SSE) ---
    const eventSource = new EventSource('/api/remote');
    eventSource.onmessage = (event) => {
      const cmd = event.data;
      console.log('[Remote] Received Command:', cmd);
      if (cmd === 'PLAY') setIsPlaying(true);
      else if (cmd === 'PAUSE') setIsPlaying(false);
      else if (cmd === 'STOP') { setIsPlaying(false); handleSeek(0); }
    };

    return () => eventSource.close();
  }, []);

  // Sync Transport Status to Remote Server (Only on state change)
  const lastSyncedStatus = useRef<string>('');
  useEffect(() => {
    const status = isPlaying ? 'play' : (currentTime > 0 ? 'pause' : 'stop');
    if (status === lastSyncedStatus.current) return;

    lastSyncedStatus.current = status;
    fetch('/api/remote/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    }).catch(err => {
      // Ignore abort errors during reload/restart
      if (err.name !== 'AbortError') console.error('[Remote] Status sync error:', err);
    });
  }, [isPlaying, currentTime === 0]);

  const checkDevices = async () => {
    const currentDevices = devicesRef.current;
    if (currentDevices.length === 0) return;
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices: currentDevices, isPing: true })
      });
      const result = await res.json();
      if (result.success && result.results) {
        const newStatus: Record<string, 'online' | 'offline'> = {};
        Object.entries(result.results).forEach(([id, isOnline]) => {
          newStatus[id] = isOnline ? 'online' : 'offline';
        });
        setDeviceStatus(newStatus);
      }
    } catch (err) {}
  };

  useEffect(() => {
    const interval = setInterval(checkDevices, PING_INTERVAL_MS);
    checkDevices();
    return () => clearInterval(interval);
  }, []);

  const sendCommand = async (device: DeviceConfig, ev: any, customData?: string) => {
    setEventStatus(prev => ({ ...prev, [ev.id]: { status: 'firing' } }));
    const data = customData !== undefined ? customData : (ev.command || '');
    try {
      const res = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device, data, format: ev.format, terminator: ev.terminator }) });
      const result = await res.json();
      if (result.success) {
        setEventStatus(prev => ({ ...prev, [ev.id]: { status: 'success', message: result.response } }));
        if (ev.type !== 'ramp' && customData === undefined) {
          setTimeout(() => setEventStatus(prev => { const newState = { ...prev }; delete newState[ev.id]; return newState; }), 2000);
        }
      } else { setEventStatus(prev => ({ ...prev, [ev.id]: { status: 'error', message: result.error } })); }
    } catch (err) { setEventStatus(prev => ({ ...prev, [ev.id]: { status: 'error', message: 'Network Error' } })); }
  };

  const handleUpdateDevice = (id: string, updates: Partial<DeviceConfig>) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  };

  const handleUpdateTrack = (id: string, updates: Partial<TrackConfig>) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const syncNtp = async () => {
    if (timeSource !== 'ntp') return;
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/ntp?server=${encodeURIComponent(ntpServer)}`);
      const data = await res.json();
      if (data.success) {
        const end = Date.now();
        setTimeOffset((data.time + (end - data.time)/2) - end);
        
        // Success: Increase interval up to max
        setCurrentNtpInterval(prev => Math.min(NTP_MAX_SYNC_INTERVAL, prev * 2));
      } else {
        // Fail: Reset to initial frequent sync
        setCurrentNtpInterval(NTP_INITIAL_SYNC_INTERVAL);
      }
    } catch (err) {
      setCurrentNtpInterval(NTP_INITIAL_SYNC_INTERVAL);
    } finally {
      setIsSyncing(false);
      // Schedule next sync
      if (ntpTimerRef.current) clearTimeout(ntpTimerRef.current);
      ntpTimerRef.current = setTimeout(syncNtp, currentNtpInterval);
    }
  };

  useEffect(() => {
    if (timeSource === 'ntp' && mode === 'realtime') {
      syncNtp();
      return () => {
        if (ntpTimerRef.current) clearTimeout(ntpTimerRef.current);
      };
    } else { 
      setTimeOffset(0); 
      if (ntpTimerRef.current) clearTimeout(ntpTimerRef.current);
    }
  }, [timeSource, ntpServer, mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(prev => !prev); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEventId) {
        setEvents(prev => prev.filter(ev => ev.id !== selectedEventId));
        setSelectedEventId(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSaveProject(projectName); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); setShowProjectManager(true); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, devices, tracks, events, projectName]);

  useEffect(() => {
    const runEngine = () => {
      const wallNow = Date.now();
      let engineNowMs = 0;
      if (mode === 'realtime') {
        engineNowMs = wallNow + timeOffset;
        const syncedDate = new Date(engineNowMs);
        engineNowMs = ((syncedDate.getHours() * 3600) + (syncedDate.getMinutes() * 60) + syncedDate.getSeconds()) * 1000 + syncedDate.getMilliseconds();
      } else {
        if (isPlaying) { 
          engineNowMs = lastFiredTime.current + ENGINE_TICK_MS;
          if (isLoopingRef.current && loopRangeRef.current) {
            if (engineNowMs >= loopRangeRef.current.end) {
              engineNowMs = loopRangeRef.current.start;
              lastFiredTime.current = engineNowMs - ENGINE_TICK_MS;
            }
          }
        } 
        else { engineNowMs = lastFiredTime.current; }
      }
      
      if (isPlaying || mode === 'realtime') {
        setCurrentTime(engineNowMs);
        
        const isWrapAround = engineNowMs < lastFiredTime.current;
        const maxTime = (mode === 'realtime') ? 86400000 : (isLoopingRef.current && loopRangeRef.current ? loopRangeRef.current.end : 86400000);
        const startTime = (mode === 'realtime') ? 0 : (isLoopingRef.current && loopRangeRef.current ? loopRangeRef.current.start : 0);

        eventsRef.current.forEach(ev => {
          let shouldFire = false;
          if (isWrapAround) {
            // Check end of previous period AND start of new one
            shouldFire = (ev.time >= lastFiredTime.current && ev.time < maxTime) || (ev.time >= startTime && ev.time < engineNowMs);
          } else {
            shouldFire = ev.time >= lastFiredTime.current && ev.time < engineNowMs;
          }

          if (shouldFire) {
            const track = tracksRef.current.find(t => t.id === ev.trackId);
            const device = devicesRef.current.find(d => d.id === track?.deviceId);
            if (device) {
              if (ev.type === 'ramp') {
                const re = ev as RampEvent;
                const startVal = parseFloat(re.startValue.toString()) || 0;
                const isOsc = device.protocol === 'osc';
                const isFloat = (re.commandTemplate || '').includes('f:');
                const startValueStr = re.startValue.toString();
                const initialCommand = (re.commandTemplate || 'VOL {value}').replace('{value}', startValueStr).replace('{valeu}', startValueStr);
                sendCommand(device, { id: ev.id, type: 'trigger', format: ev.format, terminator: ev.terminator }, initialCommand);

                setActiveRamps(prev => [...prev, {
                  id: generateId('active_ramp_'), eventId: ev.id, realStartTime: wallNow, duration: re.duration, startValue: re.startValue, endValue: re.endValue,
                  rampMode: re.rampMode || 'smooth', steps: re.steps || 10, template: re.commandTemplate, deviceId: device.id, format: ev.format, terminator: ev.terminator, 
                  lastValue: startValueStr
                }]);
              } else { sendCommand(device, ev); }
            }
          }
        });
        lastFiredTime.current = engineNowMs;
      }

      if (activeRampsRef.current.length > 0) {
        setActiveRamps(prev => {
          const nextRamps: ActiveRamp[] = [];
          prev.forEach(ramp => {
            const duration = Number(ramp.duration) || 1000;
            const startVal = Number(ramp.startValue) || 0;
            const endVal = Number(ramp.endValue) || 0;
            const elapsed = wallNow - ramp.realStartTime;
            const progress = Math.min(1, elapsed / duration);
            const device = devicesRef.current.find(d => d.id === ramp.deviceId);
            const isOsc = device?.protocol === 'osc';
            const isFloat = (ramp.template || '').includes('f:');

            let val: number;
            if (ramp.rampMode === 'stepped') {
              const steps = Math.max(1, ramp.steps);
              const stepProgress = Math.floor(progress * steps) / steps;
              val = startVal + (endVal - startVal) * stepProgress;
              if (progress >= 1) val = endVal;
            } else { 
              val = startVal + (endVal - startVal) * progress;
            }

            const finalVal = (isOsc || isFloat) ? val : Math.round(val);
            const lastValNum = ramp.lastValue !== undefined ? Number(ramp.lastValue) : -999999;
            const hasChanged = Math.abs(finalVal - lastValNum) > 0.0001;

            if (progress < 1) {
              if (hasChanged) {
                const command = (ramp.template || 'VOL {value}').replace('{value}', finalVal.toString()).replace('{valeu}', finalVal.toString());
                if (device) sendCommand(device, { id: ramp.eventId, type: 'trigger', format: ramp.format, terminator: ramp.terminator }, command);
                ramp.lastValue = finalVal;
              }
              nextRamps.push(ramp);
            } else {
              // Final value - use the original string to avoid float precision issues (like 0.899999...)
              const endValueStr = ramp.endValue.toString();
              if (ramp.lastValue?.toString() !== endValueStr) {
                const command = (ramp.template || 'VOL {value}').replace('{value}', endValueStr).replace('{valeu}', endValueStr);
                if (device) sendCommand(device, { id: ramp.eventId, type: 'trigger', format: ramp.format, terminator: ramp.terminator }, command);
                ramp.lastValue = endValueStr;
              }
              setTimeout(() => setEventStatus(os => { const n = {...os}; delete n[ramp.eventId]; return n; }), 1000);
            }
          });
          activeRampsRef.current = nextRamps;
          return nextRamps;
        });
      }
    };
    const interval = setInterval(runEngine, ENGINE_TICK_MS);
    return () => clearInterval(interval);
  }, [isPlaying, mode, timeOffset]);

  // Handlers
  const handleSelectEvent = (id: string | null) => { setSelectedEventId(id); if (id) setSelectedDeviceId(null); };
  const handleSelectDevice = (id: string | null) => { setSelectedDeviceId(id); if (id) setSelectedEventId(null); };

  const handleAddEvent = (time: number, trackId: string) => {
    const newEvent: Event = { id: generateId('ev_'), time: Math.floor(time), trackId, type: 'trigger', format: 'ascii', terminator: 'cr', command: 'NEW_COMMAND' } as Event;
    setEvents([...events, newEvent]);
    handleSelectEvent(newEvent.id);
  };

  const handleMoveEvent = (eventId: string, newTime: number, newTrackId?: string) => {
    setEvents(prev => prev.map(ev => ev.id === eventId ? { ...ev, time: Math.max(0, newTime), trackId: newTrackId || ev.trackId } : ev));
  };

  const handleCopyEvent = (sourceEventId: string, newTime: number, newTrackId?: string) => {
    const source = events.find(e => e.id === sourceEventId);
    if (source) {
      const newEvent = { ...source, id: generateId('ev_'), time: Math.max(0, newTime), trackId: newTrackId || source.trackId };
      setEvents([...events, newEvent]);
      handleSelectEvent(newEvent.id);
    }
  };

  const handleAddDevice = () => {
    const newId = generateId('dev_');
    const newDevice: DeviceConfig = { id: newId, name: `New Device ${devices.length + 1}`, ip: '127.0.0.1', port: 8000, protocol: 'tcp', color: '#8b5cf6' };
    const newTrack: TrackConfig = { id: generateId('track_'), deviceId: newId, name: `${newDevice.name} Track` };
    setDevices([...devices, newDevice]);
    setTracks([...tracks, newTrack]);
    handleSelectDevice(newId);
  };

  const handleAddTrack = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;
    const newTrack: TrackConfig = { id: generateId('track_'), deviceId, name: `${device.name} Sub-Track` };
    const lastDeviceTrackIndex = tracks.findLastIndex(t => t.deviceId === deviceId);
    if (lastDeviceTrackIndex === -1) { setTracks([...tracks, newTrack]); } 
    else { const newTracks = [...tracks]; newTracks.splice(lastDeviceTrackIndex + 1, 0, newTrack); setTracks(newTracks); }
  };

  const handleDeleteDevice = (deviceId: string) => {
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    setTracks(prev => prev.filter(t => t.deviceId !== deviceId));
    setCollapsedDeviceIds(prev => { const next = new Set(prev); next.delete(deviceId); return next; });
    setSelectedDeviceId(null);
  };

  const handleToggleDeviceCollapse = (deviceId: string) => {
    setCollapsedDeviceIds(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const handleSeek = (time: number) => { if (isLocked) return; const target = Math.max(0, time); setCurrentTime(target); lastFiredTime.current = target; setActiveRamps([]); };
  const handleStop = () => { if (isLocked) return; setIsPlaying(false); handleSeek(0); };

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-100 overflow-hidden font-sans">
      <aside className="w-16 border-r border-zinc-800 flex flex-col items-center py-6 gap-8 bg-[#0a0a0a]">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)]"><Activity size={20} className="text-white" /></div>
        <nav className="flex flex-col gap-6 text-zinc-500">
          <button className="p-2 text-blue-500 bg-blue-500/10 rounded-lg"><Layout size={20} /></button>
          <button className="p-2 hover:text-zinc-300 transition-colors" onClick={() => setShowProjectManager(true)}><FolderSearch size={20} /></button>
          <button className="p-2 hover:text-zinc-300 transition-colors" onClick={() => setShowSyncSettings(!showSyncSettings)}><Settings size={20} /></button>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#0a0a0a]/80 backdrop-blur-xl z-50">
          <div className="flex items-center gap-4">
            <div onClick={() => setShowProjectManager(true)} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-blue-500/50 cursor-pointer transition-all group">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 group-hover:animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
              <h1 className="text-[12px] font-black tracking-widest uppercase text-zinc-300 group-hover:text-white">{projectName}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleSaveProject(projectName)} 
                disabled={isLocked}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${isLocked ? 'opacity-30 cursor-not-allowed bg-zinc-900 text-zinc-600 border-zinc-800' : saveStatus === 'saved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white'}`}
              >
                {saveStatus === 'saved' ? <CheckCircle size={14} /> : <Save size={14} />} QUICK SAVE
              </button>
              <button onClick={() => handleLoadProject(projectName, true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black transition-all border ${saveStatus === 'loaded' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white'}`}>
                {saveStatus === 'loaded' ? <CheckCircle size={14} /> : <RefreshCw size={14} className={saveStatus === 'loading' ? 'animate-spin' : ''} />} QUICK LOAD
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="flex items-center bg-zinc-900/50 border border-zinc-800 rounded-xl p-1 shadow-inner">
              <button onClick={() => setZoom(prev => Math.max(MIN_ZOOM, prev / 1.5))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><ZoomOut size={16} /></button>
              <div 
                className="px-3 py-1 bg-zinc-800 rounded-lg text-[10px] font-black text-zinc-300 min-w-[65px] text-center uppercase tracking-tighter cursor-pointer hover:bg-zinc-700 transition-all"
                onClick={() => {
                  const scroller = document.querySelector('.no-scrollbar');
                  if (scroller) {
                    const fitZoom = (scroller.clientWidth - 40) / 86400;
                    setZoom(fitZoom);
                  }
                }}
                title="Click to Fit 24h"
              >
                {zoom < 1 ? zoom.toFixed(2) : Math.round(zoom)}%
              </div>
              <button onClick={() => setZoom(prev => Math.min(MAX_ZOOM, prev * 1.5))} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400"><ZoomIn size={16} /></button>
            </div>
            
            <div className="flex items-center p-1 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <button onClick={() => { setMode('relative'); setShowSyncSettings(false); }} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === 'relative' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}><Clock size={14} /> RELATIVE</button>
              <button onClick={() => setMode('realtime')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-black transition-all ${mode === 'realtime' ? 'bg-zinc-800 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}><Globe size={14} /> REAL-TIME</button>
            </div>

            <div 
              className={`flex flex-col items-end gap-0.5 bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-1.5 transition-all shadow-inner ${mode === 'realtime' ? 'border-emerald-500/30 text-emerald-400' : 'text-blue-400'} ${!isLocked && mode === 'relative' ? 'cursor-text hover:border-blue-500/40' : ''}`}
              onClick={() => { if (!isLocked && mode === 'relative') { setIsEditingTime(true); setEditingTime(msToTimeStr(currentTime)); } }}
            >
              <div className="flex items-center gap-3">
                <Clock size={14} />
                {isEditingTime ? (
                  <input
                    autoFocus
                    className="bg-transparent border-none text-blue-400 font-mono text-sm font-bold outline-none w-28 text-right"
                    value={editingTime}
                    onChange={(e) => setEditingTime(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSeek(timeStrToMs(editingTime));
                        setIsEditingTime(false);
                      } else if (e.key === 'Escape') {
                        setIsEditingTime(false);
                      }
                    }}
                    onBlur={() => {
                      handleSeek(timeStrToMs(editingTime));
                      setIsEditingTime(false);
                    }}
                  />
                ) : (
                  <span className="font-mono text-sm font-bold tabular-nums tracking-wider">
                    {mode === 'realtime' ? new Date(currentTime).toISOString().substr(11, 12) : msToTimeStr(currentTime)}
                  </span>
                )}
              </div>
              {mode === 'realtime' && (
                <div className="flex items-center gap-1.5 opacity-60">
                  <span className="text-[8px] font-black uppercase tracking-tighter">{timeSource === 'os' ? 'System' : 'NTP'}</span>
                  {timeSource === 'ntp' && <span className="text-[8px] font-mono">{timeOffset > 0 ? '+' : ''}{timeOffset}ms</span>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsLocked(!isLocked)} 
                className={`p-2.5 rounded-xl border transition-all flex items-center gap-2 ${isLocked ? 'bg-orange-500 text-white border-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300'}`}
                title={isLocked ? "Unlock Editor" : "Lock Editor"}
              >
                {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                {isLocked && <span className="text-[10px] font-black tracking-widest mr-1">LOCKED</span>}
              </button>

              <button onClick={() => setIsChasing(!isChasing)} className={`p-2 rounded-xl border transition-all ${isChasing ? 'bg-blue-500/10 text-blue-500 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-zinc-900 text-zinc-500 border-zinc-800'}`} title="Auto-Chase"><Target size={18} className={isChasing ? 'animate-pulse' : ''} /></button>
              
              {mode === 'relative' && (
                <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-2xl p-1 gap-1 shadow-2xl">
                  <button 
                    onClick={handleStop} 
                    disabled={isLocked} 
                    className={`p-2.5 rounded-xl text-zinc-400 transition-all ${isLocked ? 'opacity-20 cursor-not-allowed' : 'hover:bg-zinc-800 hover:text-white'}`}
                  >
                    <SkipBack size={18} />
                  </button>
                  
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)} 
                    disabled={isLocked && isPlaying}
                    className={`flex items-center gap-3 px-6 py-2.5 rounded-xl text-[12px] font-black transition-all ${
                      isPlaying 
                        ? (isLocked ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed' : 'bg-amber-500/10 text-amber-500 border border-amber-500/30') 
                        : 'bg-blue-600 text-white shadow-xl shadow-blue-600/30 border border-blue-500'
                    }`}
                  >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                    {isPlaying ? 'PAUSE' : 'PLAY'}
                  </button>
                  
                  <div className="w-[1px] h-6 bg-zinc-800 mx-2" />
                  
                  <button 
                    onClick={() => setIsLooping(!isLooping)} 
                    disabled={isLocked} 
                    className={`p-2.5 rounded-xl transition-all ${isLocked ? 'opacity-20 cursor-not-allowed' : isLooping ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'text-zinc-600 hover:text-zinc-300'}`} 
                    title="Loop Range"
                  >
                    <Repeat size={18} />
                  </button>
                </div>
              )}
              {mode === 'realtime' && <div className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[12px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]"><Activity size={16} /> SCHEDULE ACTIVE {isLocked && "(LOCKED)"}</div>}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
          <Timeline 
            tracks={tracks} devices={devices} events={events} onAddEvent={handleAddEvent} 
            selectedEventId={selectedEventId} selectedDeviceId={selectedDeviceId} 
            onSelectEvent={handleSelectEvent} onSelectDevice={handleSelectDevice} 
            onAddTrack={handleAddTrack} onDeleteTrack={(id) => setTracks(tracks.filter(t => t.id !== id))} 
            onDeleteDevice={handleDeleteDevice} onReorderDevices={setDevices} onAddDevice={handleAddDevice} 
            onSeek={handleSeek} currentTime={currentTime} zoom={zoom} onZoomChange={setZoom} 
            onMoveEvent={handleMoveEvent} onCopyEvent={handleCopyEvent} onReorderTracks={setTracks} 
            isChasing={isChasing} onChaseChange={setIsChasing} eventStatus={eventStatus} 
            collapsedDeviceIds={collapsedDeviceIds} onToggleDeviceCollapse={handleToggleDeviceCollapse} 
            deviceStatus={deviceStatus}
            loopRange={loopRange} onLoopRangeChange={setLoopRange}
            onUpdateDevice={handleUpdateDevice}
            onUpdateTrack={handleUpdateTrack}
            isLocked={isLocked}
          />
        </main>
      </div>
      
      {showSyncSettings && (
        <div className="fixed top-20 left-20 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[100] p-6 animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2"><Clock size={16} className="text-blue-500" /> Sync Settings</h3>
            <button onClick={() => setShowSyncSettings(false)} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"><X size={16} /></button>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Time Source Selection</label>
              <div className="flex p-1 bg-zinc-950 border border-zinc-800 rounded-xl">
                <button onClick={() => setTimeSource('os')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeSource === 'os' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}>System Clock</button>
                <button onClick={() => setTimeSource('ntp')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${timeSource === 'ntp' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-600 hover:text-zinc-400'}`}>NTP Clock</button>
              </div>
            </div>

            {timeSource === 'ntp' && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">NTP Server Address</label>
                  <input 
                    value={ntpServer} 
                    onChange={(e) => setNtpServer(e.target.value)} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-1 focus:ring-blue-500/50 outline-none"
                    placeholder="pool.ntp.org"
                  />
                </div>
                
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Clock Drift (Offset)</span>
                    <span className={`text-xs font-mono font-bold ${Math.abs(timeOffset) > 100 ? 'text-amber-500' : 'text-blue-400'}`}>
                      {timeOffset > 0 ? '+' : ''}{timeOffset}ms
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-pulse" style={{ width: `${Math.min(100, Math.abs(timeOffset/10))}%` }} />
                  </div>
                </div>

                <button 
                  onClick={syncNtp} 
                  disabled={isSyncing}
                  className={`w-full py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 hover:bg-blue-500 transition-all ${isSyncing ? 'opacity-50' : ''}`}
                >
                  {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Sync Clock Now
                </button>
              </div>
            )}
            
            <p className="text-[9px] text-zinc-600 font-medium leading-relaxed italic text-center">
              * High-precision NTP sync ensures timeline accuracy for 24-hour long-term operation.
            </p>
          </div>
        </div>
      )}

      {showProjectManager && <ProjectManager currentProjectName={projectName} onLoad={handleLoadProject} onSave={handleSaveProject} onClose={() => setShowProjectManager(false)} />}
      {selectedEvent && (
        <div className="w-80 flex-shrink-0 z-[100] relative">
          <Inspector 
            event={selectedEvent} 
            devices={devices} 
            protocol={devices.find(d => d.id === tracks.find(t => t.id === selectedEvent.trackId)?.deviceId)?.protocol}
            onUpdate={(ev) => setEvents(events.map(e => e.id === ev.id ? ev : e))} 
            onDelete={(id) => { setEvents(events.filter(e => e.id !== id)); setSelectedEventId(null); }} 
            onClose={() => setSelectedEventId(null)}
            onFire={(ev) => {
              const track = tracksRef.current.find(t => t.id === ev.trackId);
              const device = devicesRef.current.find(d => d.id === track?.deviceId);
              if (device) {
                if (ev.type === 'ramp') {
                  const re = ev as RampEvent;
                  const startVal = parseFloat(re.startValue.toString()) || 0;
                  const isOsc = device.protocol === 'osc';
                  const isFloat = (re.commandTemplate || '').includes('f:');
                  const startValueStr = re.startValue.toString();
                  const initialCommand = (re.commandTemplate || 'VOL {value}').replace('{value}', startValueStr).replace('{valeu}', startValueStr);
                  sendCommand(device, { id: ev.id, type: 'trigger', format: ev.format, terminator: ev.terminator }, initialCommand);

                  setActiveRamps(prev => {
                    const next = [...prev, {
                      id: generateId('preview_ramp_'), eventId: ev.id, realStartTime: Date.now(), duration: re.duration, startValue: re.startValue, endValue: re.endValue,
                      rampMode: re.rampMode || 'smooth', steps: re.steps || 10, template: re.commandTemplate, deviceId: device.id, format: ev.format, terminator: ev.terminator, 
                      lastValue: startValueStr
                    }];
                    activeRampsRef.current = next;
                    return next;
                  });
                } else { sendCommand(device, ev); }
              }
            }}
            lastTally={eventStatus[selectedEventId!]?.message} 
            isFiring={eventStatus[selectedEventId!]?.status === 'firing' || activeRamps.some(r => r.eventId === selectedEventId)}
            isLocked={isLocked}
          />
        </div>
      )}
      {selectedDevice && (
        <div className="w-80 flex-shrink-0 z-[100] relative">
          <DeviceInspector 
            device={selectedDevice} 
            tracks={tracks} 
            onUpdate={(d) => setDevices(devices.map(dev => dev.id === d.id ? d : dev))} 
            onUpdateTrack={(t) => setTracks(tracks.map(tr => tr.id === t.id ? t : tr))} 
            onDelete={(id) => { setDevices(devices.filter(d => d.id !== id)); setTracks(tracks.filter(t => t.deviceId === id)); setSelectedDeviceId(null); }} 
            onClose={() => setSelectedDeviceId(null)} 
            isLocked={isLocked}
          />
        </div>
      )}
    </div>
  );
}
