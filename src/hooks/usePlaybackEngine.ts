import { useState, useEffect, useRef } from 'react';
import { Event, DeviceConfig, TrackConfig, RampEvent, ActiveRamp } from '@/lib/types';

const ENGINE_TICK_MS = 10;

interface UsePlaybackEngineProps {
  mode: 'realtime' | 'relative';
  timeOffset: number;
  devices: DeviceConfig[];
  tracks: TrackConfig[];
  events: Event[];
  loopRange: { start: number, end: number } | null;
  isLooping: boolean;
  onSendCommand: (device: DeviceConfig, ev: any, customData?: string) => Promise<void>;
  onEventStatusUpdate: (eventId: string, status: 'firing' | 'success' | 'error', message?: string) => void;
  onClearEventStatus: (eventId: string) => void;
}

export function usePlaybackEngine({
  mode,
  timeOffset,
  devices,
  tracks,
  events,
  loopRange,
  isLooping,
  onSendCommand,
  onEventStatusUpdate,
  onClearEventStatus
}: UsePlaybackEngineProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeRamps, setActiveRamps] = useState<ActiveRamp[]>([]);

  const lastFiredTime = useRef<number>(0);
  const devicesRef = useRef(devices);
  const tracksRef = useRef(tracks);
  const eventsRef = useRef(events);
  const activeRampsRef = useRef(activeRamps);
  const isLoopingRef = useRef(isLooping);
  const loopRangeRef = useRef(loopRange);

  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { activeRampsRef.current = activeRamps; }, [activeRamps]);
  useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);
  useEffect(() => { loopRangeRef.current = loopRange; }, [loopRange]);

  const generateId = (prefix: string = '') => 
    `${prefix}${Math.random().toString(36).substr(2, 9)}`;

  const handleSeek = (time: number) => {
    const target = Math.max(0, time);
    setCurrentTime(target);
    lastFiredTime.current = target;
    setActiveRamps([]);
  };

  const handleStop = () => {
    setIsPlaying(false);
    handleSeek(0);
  };

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
                const startValueStr = re.startValue.toString();
                const initialCommand = (re.commandTemplate || 'VOL {value}').replace('{value}', startValueStr);
                
                onSendCommand(device, { id: ev.id, type: 'trigger', format: ev.format, terminator: ev.terminator }, initialCommand);

                setActiveRamps(prev => [...prev, {
                  id: generateId('active_ramp_'), 
                  eventId: ev.id, 
                  realStartTime: wallNow, 
                  duration: re.duration, 
                  startValue: re.startValue, 
                  endValue: re.endValue,
                  rampMode: re.rampMode || 'smooth', 
                  steps: re.steps || 10, 
                  template: re.commandTemplate, 
                  deviceId: device.id, 
                  format: ev.format, 
                  terminator: ev.terminator, 
                  lastValue: startValueStr
                }]);
              } else { 
                onSendCommand(device, ev); 
              }
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
                const command = (ramp.template || 'VOL {value}').replace('{value}', finalVal.toString());
                if (device) onSendCommand(device, { id: ramp.eventId, type: 'trigger', format: ramp.format, terminator: ramp.terminator }, command);
                ramp.lastValue = finalVal;
              }
              nextRamps.push(ramp);
            } else {
              const endValueStr = ramp.endValue.toString();
              if (ramp.lastValue?.toString() !== endValueStr) {
                const command = (ramp.template || 'VOL {value}').replace('{value}', endValueStr);
                if (device) onSendCommand(device, { id: ramp.eventId, type: 'trigger', format: ramp.format, terminator: ramp.terminator }, command);
                ramp.lastValue = endValueStr;
              }
              setTimeout(() => onClearEventStatus(ramp.eventId), 1000);
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

  return {
    currentTime,
    setCurrentTime,
    isPlaying,
    setIsPlaying,
    handleSeek,
    handleStop,
    activeRamps,
    setActiveRamps,
    lastFiredTime
  };
}
