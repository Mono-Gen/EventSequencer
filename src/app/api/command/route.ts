import { NextResponse } from 'next/server';
import { NetworkManager } from '@/lib/network/network-manager';
import { DeviceConfig } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const { device, devices, data, format, terminator, isPing } = body;
  
  const networkManager = NetworkManager.getInstance();

  try {
    // Handle Health Check (Ping) - Batch or Single
    if (isPing) {
      if (devices && Array.isArray(devices)) {
        // Batch ping
        const results: Record<string, boolean> = {};
        await Promise.all(devices.map(async (d: DeviceConfig) => {
          results[d.id] = await networkManager.pingDevice(d);
        }));
        return NextResponse.json({ success: true, results });
      } else if (device) {
        // Single ping
        const isOnline = await networkManager.pingDevice(device as DeviceConfig);
        return NextResponse.json({ success: isOnline });
      }
      return NextResponse.json({ success: false, error: 'Missing device or devices' }, { status: 400 });
    }

    // Handle Command Sending
    if (!device || data === undefined) {
      return NextResponse.json({ success: false, error: 'Missing device or data' }, { status: 400 });
    }

    const response = await networkManager.sendCommand(
      device as DeviceConfig, 
      String(data), 
      format || 'ascii', 
      terminator || 'none'
    );
    
    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    console.error(`[API] Error in command/ping:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
