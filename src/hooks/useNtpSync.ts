import { useState, useEffect, useRef } from 'react';

const NTP_INITIAL_SYNC_INTERVAL = 10000;
const NTP_MAX_SYNC_INTERVAL = 300000;

interface UseNtpSyncProps {
  enabled: boolean;
  ntpServer: string;
}

export function useNtpSync({ enabled, ntpServer }: UseNtpSyncProps) {
  const [timeOffset, setTimeOffset] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentNtpInterval, setCurrentNtpInterval] = useState(NTP_INITIAL_SYNC_INTERVAL);
  const ntpTimerRef = useRef<NodeJS.Timeout | null>(null);

  const syncNtp = async () => {
    if (!enabled) return;
    setIsSyncing(true);
    const t0 = Date.now();
    try {
      const res = await fetch(`/api/ntp?server=${encodeURIComponent(ntpServer)}`);
      const data = await res.json();
      const t3 = Date.now();

      if (data.success) {
        const offset = data.time - (t0 + t3) / 2;
        setTimeOffset(Math.round(offset));
        setCurrentNtpInterval(prev => Math.min(NTP_MAX_SYNC_INTERVAL, prev * 2));
      } else {
        setCurrentNtpInterval(NTP_INITIAL_SYNC_INTERVAL);
      }
    } catch (err) {
      setCurrentNtpInterval(NTP_INITIAL_SYNC_INTERVAL);
    } finally {
      setIsSyncing(false);
      if (ntpTimerRef.current) clearTimeout(ntpTimerRef.current);
      ntpTimerRef.current = setTimeout(syncNtp, currentNtpInterval);
    }
  };

  useEffect(() => {
    if (enabled) {
      syncNtp();
      return () => {
        if (ntpTimerRef.current) clearTimeout(ntpTimerRef.current);
      };
    } else {
      setTimeOffset(0);
      if (ntpTimerRef.current) clearTimeout(ntpTimerRef.current);
    }
  }, [enabled, ntpServer]);

  return { timeOffset, isSyncing, syncNtp };
}
