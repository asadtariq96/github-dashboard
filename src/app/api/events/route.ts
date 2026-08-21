import { NextRequest } from 'next/server';
import { prEventEmitter } from '../../../lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`));

      // Subscribe to backend cache updates
      const unsubscribe = prEventEmitter.subscribe(() => {
        try {
          controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify({ time: new Date().toISOString() })}\n\n`));
        } catch {
          unsubscribe();
        }
      });

      // Heartbeat ping every 15 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
          unsubscribe();
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
