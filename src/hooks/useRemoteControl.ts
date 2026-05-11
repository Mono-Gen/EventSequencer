import { useEffect, useRef } from 'react';

interface UseRemoteControlProps {
  isPlaying: boolean;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function useRemoteControl({
  isPlaying,
  currentTime,
  onPlay,
  onPause,
  onStop
}: UseRemoteControlProps) {
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onStopRef = useRef(onStop);

  useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);
  useEffect(() => { onPauseRef.current = onPause; }, [onPause]);
  useEffect(() => { onStopRef.current = onStop; }, [onStop]);

  useEffect(() => {
    const eventSource = new EventSource('/api/remote');
    eventSource.onmessage = (event) => {
      const cmd = event.data;
      console.log('[Remote] Received Command:', cmd);
      if (cmd === 'PLAY') onPlayRef.current();
      else if (cmd === 'PAUSE') onPauseRef.current();
      else if (cmd === 'STOP') onStopRef.current();
    };

    return () => eventSource.close();
  }, []); // Empty dependency array prevents reconnection on every render

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
      if (err.name !== 'AbortError') console.error('[Remote] Status sync error:', err);
    });
  }, [isPlaying, currentTime === 0]); // Optimize evaluation frequency
}
