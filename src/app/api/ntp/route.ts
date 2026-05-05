import { NextRequest, NextResponse } from 'next/server';
import dgram from 'dgram';

// NTP Packet Constants
const NTP_PORT = 123;
const NTP_PACKET_SIZE = 48;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ntpServer = searchParams.get('server') || 'pool.ntp.org';

  try {
    const time = await getNtpTime(ntpServer);
    return NextResponse.json({ success: true, time });
  } catch (err) {
    console.error('NTP Sync Error:', err);
    return NextResponse.json({ success: false, error: 'NTP Sync Failed' }, { status: 500 });
  }
}

function getNtpTime(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    const ntpData = Buffer.alloc(NTP_PACKET_SIZE);
    
    // Initial byte: LI=0, VN=3, Mode=3 (Client)
    ntpData[0] = 0x1B;

    const timeout = setTimeout(() => {
      client.close();
      reject(new Error('NTP Timeout'));
    }, 3000);

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.close();
      reject(err);
    });

    client.on('message', (msg) => {
      clearTimeout(timeout);
      client.close();

      // Extract transmit timestamp (bytes 40-47)
      // Seconds from 1900-01-01
      const secondsSince1900 = msg.readUInt32BE(40);
      // Convert to Unix Epoch (milliseconds since 1970-01-01)
      const unixEpochMs = (secondsSince1900 - 2208988800) * 1000;
      
      resolve(unixEpochMs);
    });

    client.send(ntpData, 0, NTP_PACKET_SIZE, NTP_PORT, host, (err) => {
      if (err) {
        clearTimeout(timeout);
        client.close();
        reject(err);
      }
    });
  });
}
