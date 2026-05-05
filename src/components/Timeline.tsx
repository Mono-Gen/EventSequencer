"use client";

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { DeviceConfig, TrackConfig, Event } from '@/lib/types';
import { 
  Plus, Trash2, ChevronRight, ChevronDown, 
  Layers, GripVertical, 
  PlusCircle, Power, PowerOff, Zap, Activity,
  Repeat, Edit3, Lock
} from 'lucide-react';

interface TimelineProps {
  tracks: TrackConfig[];
  devices: DeviceConfig[];
  events: Event[];
  onAddEvent: (time: number, trackId: string) => void;
  selectedEventId: string | null;
  selectedDeviceId: string | null;
  onSelectEvent: (id: string | null) => void;
  onSelectDevice: (id: string | null) => void;
  onAddTrack: (deviceId: string) => void;
  onDeleteTrack: (trackId: string) => void;
  onDeleteDevice: (deviceId: string) => void;
  onReorderDevices: (devices: DeviceConfig[]) => void;
  onAddDevice: () => void;
  onSeek: (time: number) => void;
  currentTime: number;
  zoom: number; 
  onZoomChange: (zoom: number) => void;
  onMoveEvent: (eventId: string, newTime: number, newTrackId?: string) => void;
  onCopyEvent: (sourceEventId: string, newTime: number, newTrackId?: string) => void;
  onReorderTracks: (tracks: TrackConfig[]) => void;
  isChasing: boolean;
  onChaseChange: (isChasing: boolean) => void;
  eventStatus: Record<string, { status: 'firing' | 'success' | 'error', message?: string }>;
  collapsedDeviceIds: Set<string>;
  onToggleDeviceCollapse: (deviceId: string) => void;
  deviceStatus: Record<string, 'online' | 'offline' | 'checking'>;
  loopRange: { start: number, end: number } | null;
  onLoopRangeChange: (range: { start: number, end: number } | null) => void;
  onUpdateDevice: (deviceId: string, updates: Partial<DeviceConfig>) => void;
  onUpdateTrack: (trackId: string, updates: Partial<TrackConfig>) => void;
  isLocked?: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({
  tracks, devices, events, onAddEvent,
  selectedEventId, selectedDeviceId, onSelectEvent, onSelectDevice,
  onAddTrack, onDeleteTrack, onDeleteDevice, onReorderDevices,
  onAddDevice, onSeek, currentTime, zoom,
  onZoomChange, onMoveEvent, onCopyEvent, onReorderTracks,
  isChasing, onChaseChange, eventStatus,
  collapsedDeviceIds, onToggleDeviceCollapse, deviceStatus,
  loopRange, onLoopRangeChange,
  onUpdateDevice, onUpdateTrack,
  isLocked = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  
  const [scrollPos, setScrollPos] = useState({ left: 0, width: 0 });
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isSelectingRange, setIsSelectingRange] = useState(false);
  const [draggingRangeHandle, setDraggingRangeHandle] = useState<'start' | 'end' | null>(null);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [draggedDeviceId, setDraggedDeviceId] = useState<string | null>(null);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [editingRange, setEditingRange] = useState<'start' | 'end' | null>(null);
  const [editValue, setEditValue] = useState("");
  
  // Sidebar Resize State
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [hasManuallyResized, setHasManuallyResized] = useState(false);

  // Inline Editing State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const formatTime = (seconds: number, precision: boolean = false) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return (precision || zoom > 800) ? `${timeStr}.${ms.toString().padStart(2, '0')}` : timeStr;
  };

  const parseTimeToSeconds = (str: string) => {
    const parts = str.split(':').reverse();
    let seconds = 0;
    if (parts[0]) {
      const sParts = parts[0].split('.');
      seconds += parseInt(sParts[0]);
      if (sParts[1]) seconds += parseInt(sParts[1]) / 100;
    }
    if (parts[1]) seconds += parseInt(parts[1]) * 60;
    if (parts[2]) seconds += parseInt(parts[2]) * 3600;
    return seconds;
  };

  const calculateAutoWidth = () => {
    let maxChars = 12;
    devices.forEach(d => { if (d.name.length > maxChars) maxChars = d.name.length; });
    tracks.forEach(t => { if (t.name.length + 2 > maxChars) maxChars = t.name.length + 2; });
    const estimatedWidth = (maxChars * 10) + 160; 
    return Math.min(600, Math.max(260, estimatedWidth));
  };

  // Auto-resize sidebar based on content
  useEffect(() => {
    if (hasManuallyResized) return;
    const targetWidth = calculateAutoWidth();
    if (targetWidth !== sidebarWidth) {
      setSidebarWidth(targetWidth);
    }
  }, [devices, tracks, hasManuallyResized]);

  const handleResetAutoWidth = () => {
    if (isLocked) return;
    setHasManuallyResized(false);
    setSidebarWidth(calculateAutoWidth());
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => setScrollPos({ left: el.scrollLeft, width: el.clientWidth });
    handleScroll();
    el.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const scroller = scrollContainerRef.current;
    if (!container || !scroller) return;
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const targetTimeSec = currentTime / 1000;
        const playheadScreenX = (targetTimeSec * zoom) - scroller.scrollLeft;
        const zoomFactor = e.deltaY > 0 ? 0.85 : 1.15;
        const nextZoom = Math.min(8000, Math.max(0.01, zoom * zoomFactor));
        onZoomChange(nextZoom);
        scroller.scrollLeft = (targetTimeSec * nextZoom) - playheadScreenX;
      }
    };
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleNativeWheel);
  }, [zoom, onZoomChange, currentTime]);

  // Auto-Chase Logic: Follow playhead
  useEffect(() => {
    if (!isChasing || isDraggingPlayhead || !scrollContainerRef.current) return;
    const scroller = scrollContainerRef.current;
    const playheadX = (currentTime / 1000) * zoom;
    const viewLeft = scroller.scrollLeft;
    const viewWidth = scroller.clientWidth;
    
    // If playhead moves beyond 80% of the view or is behind the left edge
    if (playheadX > viewLeft + viewWidth * 0.8 || playheadX < viewLeft) {
      scroller.scrollLeft = playheadX - viewWidth * 0.2; // Instant jump
    }
  }, [currentTime, zoom, isChasing, isDraggingPlayhead]);

  const handleMouseMove = (e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = Math.min(600, Math.max(150, e.clientX - (containerRef.current?.getBoundingClientRect().left || 0)));
      setSidebarWidth(newWidth);
      setHasManuallyResized(true);
      return;
    }

    const rect = trackAreaRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (isDraggingPlayhead) onSeek(Math.max(0, ((e.clientX - rect.left) / zoom) * 1000));
    if (isSelectingRange && rangeStart !== null) {
      const currentPos = Math.max(0, ((e.clientX - rect.left) / zoom) * 1000);
      onLoopRangeChange({ start: Math.min(rangeStart, currentPos), end: Math.max(rangeStart, currentPos) });
    }
    if (draggingRangeHandle && loopRange) {
      const newTime = Math.max(0, ((e.clientX - rect.left) / zoom) * 1000);
      if (draggingRangeHandle === 'start') onLoopRangeChange({ ...loopRange, start: Math.min(newTime, loopRange.end - 10) });
      else onLoopRangeChange({ ...loopRange, end: Math.max(newTime, loopRange.start + 10) });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingPlayhead(false);
    setIsSelectingRange(false);
    setDraggingRangeHandle(null);
    setRangeStart(null);
    setDraggedDeviceId(null);
    setDraggedTrackId(null);
    setIsResizingSidebar(false);
  };

  useEffect(() => {
    if (isDraggingPlayhead || isSelectingRange || draggingRangeHandle || isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingPlayhead, isSelectingRange, draggingRangeHandle, rangeStart, zoom, loopRange, isResizingSidebar]);

  const rulerElements = useMemo(() => {
    const elements = [];
    const durationSec = 86400; 
    const idealLabelSpacing = 100; 
    const baseSteps = [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800, 3600, 7200, 14400, 28800, 43200, 86400];
    let step = baseSteps.find(s => s * zoom >= idealLabelSpacing) || baseSteps[baseSteps.length - 1];
    let subStep = step / 5;
    const startSec = Math.floor(scrollPos.left / zoom);
    const endSec = Math.ceil((scrollPos.left + scrollPos.width) / zoom);
    const alignedStart = Math.floor(startSec / step) * step;
    for (let i = alignedStart; i <= endSec && i <= durationSec; i += step) {
      if (i < 0) continue;
      elements.push({ type: 'label', time: i, major: true });
      for (let j = 1; j < 5; j++) {
        const subTime = i + j * subStep;
        if (subTime <= endSec && subTime <= durationSec) {
          const showTimeOnTick = subStep * zoom > 60; 
          elements.push({ type: showTimeOnTick ? 'label' : 'tick', time: subTime, major: false });
        }
      }
    }
    return elements;
  }, [zoom, scrollPos]);

  const handleRangeEdit = (type: 'start' | 'end') => {
    if (!loopRange || isLocked) return;
    const newSeconds = parseTimeToSeconds(editValue);
    if (!isNaN(newSeconds)) {
      const newTime = newSeconds * 1000;
      if (type === 'start') onLoopRangeChange({ ...loopRange, start: Math.min(newTime, loopRange.end - 10) });
      else onLoopRangeChange({ ...loopRange, end: Math.max(newTime, loopRange.start + 10) });
    }
    setEditingRange(null);
  };

  const handleStartEditing = (id: string, initialName: string) => {
    if (isLocked) return;
    setEditingItemId(id);
    setEditNameValue(initialName);
  };

  const handleFinishEditingName = (id: string, type: 'device' | 'track') => {
    if (type === 'device') onUpdateDevice(id, { name: editNameValue });
    else onUpdateTrack(id, { name: editNameValue });
    setEditingItemId(null);
  };

  const isVisible = (timeMs: number, durationMs: number = 0) => {
    const x = (timeMs / 1000) * zoom;
    const width = (durationMs / 1000) * zoom;
    return x + width >= scrollPos.left - 400 && x <= scrollPos.left + scrollPos.width + 400;
  };

  const handleDeviceDrop = (targetId: string) => {
    if (isLocked || !draggedDeviceId || draggedDeviceId === targetId) return;
    const draggedIdx = devices.findIndex(d => d.id === draggedDeviceId);
    const targetIdx = devices.findIndex(d => d.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const newDevices = [...devices];
    const [draggedItem] = newDevices.splice(draggedIdx, 1);
    newDevices.splice(targetIdx, 0, draggedItem);
    onReorderDevices(newDevices);
    setDraggedDeviceId(null);
  };

  const handleTrackDrop = (targetTrackId: string, targetDeviceId: string) => {
    if (isLocked || !draggedTrackId || draggedTrackId === targetTrackId) return;
    const draggedIdx = tracks.findIndex(t => t.id === draggedTrackId);
    const targetIdx = tracks.findIndex(t => t.id === targetTrackId);
    if (draggedIdx === -1 || targetIdx === -1) return;
    const newTracks = [...tracks];
    const [draggedItem] = newTracks.splice(draggedIdx, 1);
    draggedItem.deviceId = targetDeviceId;
    newTracks.splice(targetIdx, 0, draggedItem);
    onReorderTracks(newTracks);
    setDraggedTrackId(null);
  };

  return (
    <div ref={containerRef} className={`flex-1 flex flex-col min-h-0 bg-[#0a0a0a] rounded-2xl border ${isLocked ? 'border-orange-500/50' : 'border-zinc-800'} shadow-2xl overflow-hidden relative transition-colors duration-500`}>
      <div className="flex h-12 bg-zinc-900 border-b border-zinc-800 z-50">
        <div 
          className="shrink-0 border-r border-zinc-800 flex items-center px-5 justify-between bg-zinc-900 shadow-[2px_0_10px_rgba(0,0,0,0.5)] relative select-none"
          style={{ width: sidebarWidth }}
          onDoubleClick={handleResetAutoWidth}
        >
          <div className="flex items-center gap-2 min-w-0 pointer-events-none">
            <span className="text-[13px] font-black tracking-widest text-zinc-200 uppercase truncate">TRACK LIST</span>
            {isLocked && <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-500/10 border border-orange-500/20"><Lock size={10} className="text-orange-500" /><span className="text-[8px] font-black text-orange-500">LOCKED</span></div>}
          </div>
          {!isLocked && <button onClick={onAddDevice} className="p-1.5 hover:bg-zinc-800 rounded-lg text-blue-500 transition-colors shrink-0"><Plus size={16} /></button>}
          <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-[100]" onMouseDown={() => setIsResizingSidebar(true)} onDoubleClick={handleResetAutoWidth} />
        </div>
        
        <div className="flex-1 relative overflow-hidden cursor-crosshair select-none bg-zinc-950" 
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const time = ((e.clientX - rect.left + scrollPos.left) / zoom) * 1000;
            if (e.shiftKey || e.ctrlKey) { setIsSelectingRange(true); setRangeStart(time); } 
            else { onSeek(time); setIsDraggingPlayhead(true); onChaseChange(false); }
          }}
        >
          {rulerElements.map((el, idx) => (
            <div key={`${el.type}_${el.time}_${idx}`} className="absolute inset-y-0 pointer-events-none" style={{ left: el.time * zoom - scrollPos.left }}>
              {el.type === 'label' ? (
                <>
                  <div className={`absolute top-0 left-0 px-1.5 py-0.5 rounded-br border-r border-b backdrop-blur-sm z-10 transition-all
                    ${el.major ? 'bg-zinc-800/95 border-zinc-600 shadow-md scale-100' : 'bg-zinc-900/60 border-zinc-800 scale-[0.85] opacity-80'}`}>
                    <span className={`font-black font-mono tracking-tighter whitespace-nowrap
                      ${el.major ? 'text-[10px] text-zinc-100' : 'text-[9px] text-zinc-400'}`}>
                      {formatTime(el.time)}
                    </span>
                  </div>
                  <div className={`absolute bottom-0 border-l-2 transition-all ${el.major ? 'h-5 border-zinc-500' : 'h-3 border-zinc-700'}`} />
                </>
              ) : (
                <div className="absolute bottom-0 h-2 border-l border-zinc-800/50" />
              )}
            </div>
          ))}

          {loopRange && isVisible(loopRange.start, loopRange.end - loopRange.start) && (
            <div 
              className="absolute inset-y-0 bg-emerald-500/25 border-x-2 border-emerald-500/80 z-40 flex flex-col justify-between"
              style={{ left: (loopRange.start / 1000) * zoom - scrollPos.left, width: ((loopRange.end - loopRange.start) / 1000) * zoom }}
              onContextMenu={(e) => { e.preventDefault(); if(!isLocked) onLoopRangeChange(null); }}
            >
              <div className="flex justify-between px-2 pt-1 items-start">
                <div className={`cursor-ew-resize group/h relative ${isLocked ? 'pointer-events-none' : ''}`} onMouseDown={(e) => { e.stopPropagation(); if(!isLocked) setDraggingRangeHandle('start'); }} onClick={(e) => { e.stopPropagation(); if(!isLocked) { setEditingRange('start'); setEditValue(formatTime(loopRange.start/1000, true)); } }}>
                  {editingRange === 'start' ? (
                    <input autoFocus className="text-[9px] font-black bg-white text-black px-1.5 rounded-sm w-20 outline-none" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleRangeEdit('start')} onKeyDown={(e) => e.key === 'Enter' && handleRangeEdit('start')} />
                  ) : (
                    <span className="text-[9px] font-black bg-emerald-500 text-black px-1.5 rounded-sm shadow-lg group-hover/h:scale-110 transition-transform block">{formatTime(loopRange.start/1000, true)}</span>
                  )}
                </div>
                
                <div className="flex gap-2 items-start">
                  <div className={`cursor-ew-resize group/h relative ${isLocked ? 'pointer-events-none' : ''}`} onMouseDown={(e) => { e.stopPropagation(); if(!isLocked) setDraggingRangeHandle('end'); }} onClick={(e) => { e.stopPropagation(); if(!isLocked) { setEditingRange('end'); setEditValue(formatTime(loopRange.end/1000, true)); } }}>
                    {editingRange === 'end' ? (
                      <input autoFocus className="text-[9px] font-black bg-white text-black px-1.5 rounded-sm w-20 outline-none" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleRangeEdit('end')} onKeyDown={(e) => e.key === 'Enter' && handleRangeEdit('end')} />
                    ) : (
                      <span className="text-[9px] font-black bg-emerald-500 text-black px-1.5 rounded-sm shadow-lg group-hover/h:scale-110 transition-transform block">{formatTime(loopRange.end/1000, true)}</span>
                    )}
                  </div>
                  {!isLocked && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onLoopRangeChange(null); }}
                      className="p-0.5 bg-emerald-500 text-black rounded hover:bg-white transition-colors shadow-lg"
                      title="Clear Loop Range"
                    >
                      <Plus size={10} className="rotate-45" />
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1 bg-emerald-500/50 mb-1 mx-1 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div 
          className="shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900/60 z-20 overflow-y-auto no-scrollbar relative"
          style={{ width: sidebarWidth }}
        >
          {devices.map((device) => {
            const isCollapsed = collapsedDeviceIds.has(device.id);
            const deviceTracks = tracks.filter(t => t.deviceId === device.id);
            const status = deviceStatus[device.id] || 'checking';
            const themeColor = device.color || '#3b82f6';
            const isEditing = editingItemId === device.id;

            return (
              <div 
                key={device.id} 
                className={`border-b border-zinc-800 transition-opacity relative group/dev ${draggedDeviceId === device.id ? 'opacity-20' : 'opacity-100'}`} 
                draggable={!isLocked}
                onDragStart={() => !isLocked && setDraggedDeviceId(device.id)}
                onDragEnd={() => setDraggedDeviceId(null)}
                onDragOver={(e) => { if(!isLocked) { e.preventDefault(); e.currentTarget.style.borderTop = '2px solid #3b82f6'; } }}
                onDragLeave={(e) => { e.currentTarget.style.borderTop = ''; }}
                onDrop={(e) => { if(!isLocked) { e.preventDefault(); e.currentTarget.style.borderTop = ''; handleDeviceDrop(device.id); } }}
              >
                <div className={`h-12 flex items-center px-4 gap-3 hover:bg-white/[0.05] cursor-pointer transition-all relative ${selectedDeviceId === device.id ? 'bg-white/[0.08]' : ''}`} style={{ borderLeft: `6px solid ${themeColor}` }} onClick={() => onSelectDevice(device.id)}>
                  <div className="absolute inset-0 opacity-[0.05]" style={{ background: `linear-gradient(to right, ${themeColor}, transparent)` }} />
                  <button onClick={(e) => { e.stopPropagation(); onToggleDeviceCollapse(device.id); }} className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-400 z-10">{isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}</button>
                  <div className={`w-3 h-3 rounded-full shrink-0 z-10 ${status === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : status === 'offline' ? 'bg-red-500' : 'bg-zinc-600 animate-pulse'}`} />
                  
                  <div className="flex-1 min-w-0 z-10 flex items-center gap-3">
                    {isEditing ? (
                      <input autoFocus className="w-full bg-zinc-950 border border-blue-500 rounded px-2 py-0.5 text-[13px] font-black text-white outline-none" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={() => handleFinishEditingName(device.id, 'device')} onKeyDown={(e) => e.key === 'Enter' && handleFinishEditingName(device.id, 'device')} onClick={(e) => e.stopPropagation()} />
                    ) : (
                      <>
                        <span className="text-[13px] font-black text-white truncate uppercase tracking-wide group-hover/dev:text-blue-400 transition-colors shrink-0" onDoubleClick={(e) => { e.stopPropagation(); if(!isLocked) handleStartEditing(device.id, device.name); }}>{device.name}</span>
                        {!isLocked && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/dev:opacity-100 transition-opacity bg-zinc-900/80 backdrop-blur-sm rounded-lg py-1 px-1">
                            <button onClick={(e) => { e.stopPropagation(); handleStartEditing(device.id, device.name); }} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Edit3 size={15} /></button>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteDevice(device.id); }} className="p-1 hover:bg-red-500/20 rounded text-red-500 transition-colors"><Trash2 size={15} /></button>
                            <button onClick={(e) => { e.stopPropagation(); onAddTrack(device.id); }} className="p-1 hover:bg-zinc-700 rounded text-zinc-400 transition-colors"><Plus size={15} /></button>
                            <div className="p-1 cursor-grab text-zinc-600"><GripVertical size={15} /></div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!isCollapsed && deviceTracks.map(track => {
                  const isTrackEditing = editingItemId === track.id;
                  return (
                    <div 
                      key={track.id} 
                      className={`h-[48px] flex items-center px-6 gap-3 border-t border-zinc-800/40 group/track hover:bg-white/[0.03] transition-colors cursor-pointer relative ${draggedTrackId === track.id ? 'opacity-20' : 'opacity-100'}`} 
                      onClick={() => onSelectDevice(device.id)}
                      draggable={!isLocked}
                      onDragStart={(e) => { if(!isLocked) { e.stopPropagation(); setDraggedTrackId(track.id); } }}
                      onDragEnd={() => setDraggedTrackId(null)}
                      onDragOver={(e) => { if(!isLocked) { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderTop = '2px solid #10b981'; } }}
                      onDragLeave={(e) => { e.currentTarget.style.borderTop = ''; }}
                      onDrop={(e) => { if(!isLocked) { e.preventDefault(); e.stopPropagation(); e.currentTarget.style.borderTop = ''; handleTrackDrop(track.id, device.id); } }}
                    >
                      <Layers size={14} className="text-zinc-600 shrink-0" />
                      
                      <div className="flex-1 min-w-0 flex items-center gap-3">
                        {isTrackEditing ? (
                          <input autoFocus className="w-full bg-zinc-950 border border-blue-500 rounded px-2 py-0.5 text-[11px] font-bold text-zinc-300 outline-none" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={() => handleFinishEditingName(track.id, 'track')} onKeyDown={(e) => e.key === 'Enter' && handleFinishEditingName(track.id, 'track')} onClick={(e) => e.stopPropagation()} />
                        ) : (
                          <>
                            <span className="text-[11px] text-zinc-400 font-bold truncate uppercase group-hover/track:text-zinc-200 transition-colors shrink-0" onDoubleClick={(e) => { e.stopPropagation(); if(!isLocked) handleStartEditing(track.id, track.name); }}>{track.name}</span>
                            {!isLocked && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/track:opacity-100 transition-all bg-zinc-900/80 backdrop-blur-sm rounded-lg py-1 px-1">
                                <button onClick={(e) => { e.stopPropagation(); handleStartEditing(track.id, track.name); }} className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-200 transition-all"><Edit3 size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteTrack(track.id); }} className="p-1 hover:bg-red-500/20 rounded text-red-500 transition-all"><Trash2 size={14} /></button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!isLocked && (
            <button onClick={onAddDevice} className="p-6 flex items-center justify-center gap-3 text-zinc-300 hover:text-blue-400 hover:bg-blue-500/5 transition-all border-t border-dashed border-zinc-800 mt-auto"><PlusCircle size={22} /><span className="text-[13px] font-black uppercase tracking-widest truncate">Add Device</span></button>
          )}
          <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-[100]" onMouseDown={() => setIsResizingSidebar(true)} onDoubleClick={handleResetAutoWidth} />
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-auto relative bg-[#050505] no-scrollbar">
          <div ref={trackAreaRef} className="relative" style={{ width: (86400 * zoom) + 'px', height: '100%', backgroundImage: `linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)`, backgroundSize: `${zoom}px 48px`, backgroundAttachment: 'local' }}>
            {loopRange && <div className="absolute top-0 h-full bg-emerald-500/5 border-x border-emerald-500/20 pointer-events-none z-0" style={{ left: (loopRange.start / 1000) * zoom, width: ((loopRange.end - loopRange.start) / 1000) * zoom }} />}
            
            {devices.map(device => {
              const isCollapsed = collapsedDeviceIds.has(device.id);
              const deviceTracks = tracks.filter(t => t.deviceId === device.id);
              const trackIds = deviceTracks.map(t => t.id);
              const deviceEvents = events.filter(e => trackIds.includes(e.trackId));
              return (
                <React.Fragment key={device.id}>
                  <div className="h-12 border-b border-zinc-800/60 relative bg-zinc-900/10">
                    {deviceEvents.filter(ev => isVisible(ev.time, (ev as any).duration || 0)).map(ev => {
                      const evColor = ev.type === 'ramp' ? '#f59e0b' : ev.type === 'on' ? '#10b981' : ev.type === 'off' ? '#71717a' : '#3b82f6';
                      return <div key={`sum_${ev.id}`} className="absolute inset-y-0 w-[2.5px] opacity-100 pointer-events-none" style={{ left: (ev.time / 1000) * zoom, backgroundColor: evColor, boxShadow: `0 0 10px ${evColor}aa` }} />;
                    })}
                  </div>
                  {!isCollapsed && deviceTracks.map(track => (
                    <div key={track.id} className="h-[48px] border-b border-zinc-800/40 relative group/row hover:bg-white/[0.02] transition-colors" onDoubleClick={(e) => { if(!isLocked) { const rect = e.currentTarget.getBoundingClientRect(); const x = e.clientX - rect.left; onAddEvent((x / zoom) * 1000, track.id); } }}>
                      {events.filter(e => e.trackId === track.id && isVisible(e.time, (e as any).duration || 0)).map(ev => {
                        const isSelected = selectedEventId === ev.id;
                        return (
                          <div key={ev.id} onMouseDown={(e) => { e.stopPropagation(); onSelectEvent(ev.id); if(!isLocked) { const rect = e.currentTarget.getBoundingClientRect(); const offset = e.clientX - rect.left; const handleMove = (me: MouseEvent) => { const tr = trackAreaRef.current?.getBoundingClientRect(); if (tr) { const newTime = ((me.clientX - tr.left - offset) / zoom) * 1000; if (e.altKey) onCopyEvent(ev.id, newTime); else onMoveEvent(ev.id, newTime); } }; window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', () => window.removeEventListener('mousemove', handleMove), { once: true }); } }}
                            className={`absolute top-2.5 h-8 px-3 rounded-xl flex items-center gap-2 cursor-move border z-10 transition-all ${ev.type === 'on' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : ev.type === 'off' ? 'bg-zinc-800 border-zinc-600 text-zinc-400' : ev.type === 'ramp' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' : 'bg-blue-500/20 border-blue-500/50 text-blue-400'} ${isSelected ? 'ring-2 ring-white scale-105 z-20 shadow-[0_0_25px_rgba(255,255,255,0.4)] border-white' : ''} ${eventStatus[ev.id]?.status === 'firing' ? 'animate-pulse scale-110 brightness-150' : ''}`}
                            style={{ left: (ev.time / 1000) * zoom, width: ev.type === 'ramp' ? Math.max(60, ((ev as any).duration / 1000) * zoom) : 'auto' }}
                          >
                            {ev.type === 'on' ? <Power size={14} /> : ev.type === 'off' ? <PowerOff size={14} /> : ev.type === 'ramp' ? <Activity size={14} /> : <Zap size={14} fill="currentColor" />}
                            <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">{ev.type === 'ramp' ? `RAMP ${(ev as any).startValue}→${(ev as any).endValue}` : ev.type === 'on' ? 'ON' : ev.type === 'off' ? 'OFF' : 'TRIGGER'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
            <div className="absolute top-0 bottom-0 w-[2px] bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.7)] z-40 pointer-events-none" style={{ left: (currentTime / 1000) * zoom }}>
              <div className="absolute -top-1.5 -left-[7px] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-red-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="h-8 bg-zinc-900 border-t border-zinc-800 flex items-center px-6 justify-between z-50">
        <div className="flex gap-6">
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">TRIGGER</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">ON</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-zinc-700" /><span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">OFF</span></div>
          <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">RAMP</span></div>
        </div>
        <div className="text-[10px] font-black font-mono text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          {loopRange ? (
            <div className="flex items-center gap-3">
              <Repeat size={12} className="text-emerald-500" /> 
              <span>RANGE: <span className="text-emerald-400">{formatTime(loopRange.start/1000, true)} - {formatTime(loopRange.end/1000, true)}</span></span>
              {!isLocked && (
                <button 
                  onClick={() => onLoopRangeChange(null)}
                  className="px-2 py-0.5 bg-zinc-800 hover:bg-red-500/20 hover:text-red-500 text-[9px] rounded border border-zinc-700 transition-all ml-1"
                >
                  CLEAR
                </button>
              )}
            </div>
          ) : (
            <span className="opacity-50">Shift + Drag Ruler for Loop | Ctrl + Wheel to Zoom</span>
          )}
        </div>
      </div>
    </div>
  );
};
