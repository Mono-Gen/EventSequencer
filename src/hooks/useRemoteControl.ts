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
  useEffect(() => {
    const eventSource = new EventSource('/api/remote');
    eventSource.onmessage = (event) => {
      const cmd = event.data;
      console.log('[Remote] Received Command:', cmd);
      if (cmd === 'PLAY') onPlay();
      else if (cmd === 'PAUSE') onPause();
      else if (cmd === 'STOP') onStop();
    };

    return () => eventSource.close();
  }, [onPlay, onPause, onStop]);

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
  }, [isPlaying, currentTime]);
}
