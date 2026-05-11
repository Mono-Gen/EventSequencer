import { useState, useEffect, useRef } from 'react';
import { DeviceConfig } from '@/lib/types';

const PING_INTERVAL_MS = 1000;

export function useDeviceMonitor(devices: DeviceConfig[]) {
  const [deviceStatus, setDeviceStatus] = useState<Record<string, 'online' | 'offline' | 'checking'>>({});
  const devicesRef = useRef(devices);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

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
    } catch (err) {
      console.error('[DeviceMonitor] Ping failed:', err);
    }
  };

  useEffect(() => {
    const interval = setInterval(checkDevices, PING_INTERVAL_MS);
    checkDevices();
    return () => clearInterval(interval);
  }, []);

  return { deviceStatus, setDeviceStatus, checkDevices };
}
