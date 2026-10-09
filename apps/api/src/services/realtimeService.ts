import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initRealtime(server: HttpServer) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'Connected to BloodLink AI Realtime Hub' }));

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
      clients.delete(ws);
    });
  });

  console.log('[Realtime] WebSocket server initialized on /ws');
}

export function broadcastRealtimeEvent(eventType: string, payload: any) {
  const message = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString()
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('[Realtime] Failed to broadcast to client:', err);
      }
    }
  }
}
