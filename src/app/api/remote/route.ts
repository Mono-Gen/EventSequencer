import { NextRequest } from 'next/server';
import { remoteStore } from '@/lib/remoteStore';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const onCommand = (cmd: string) => {
        controller.enqueue(encoder.encode(`data: ${cmd}\n\n`));
      };

      remoteStore.on('command', onCommand);

      // 初期接続確認
      controller.enqueue(encoder.encode(`data: CONNECTED\n\n`));

      // 接続終了時のクリーンアップ
      req.signal.addEventListener('abort', () => {
        remoteStore.off('command', onCommand);
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
