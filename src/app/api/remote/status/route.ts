import { NextRequest, NextResponse } from 'next/server';
import { remoteStore } from '@/lib/remoteStore';

export async function POST(req: NextRequest) {
  try {
    const { status } = await req.json();
    if (status === 'play' || status === 'pause' || status === 'stop') {
      remoteStore.setStatus(status);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
