"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRealtime = initRealtime;
exports.broadcastRealtimeEvent = broadcastRealtimeEvent;
const ws_1 = require("ws");
let wss = null;
const clients = new Set();
function initRealtime(server) {
    wss = new ws_1.WebSocketServer({ server, path: '/ws' });
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
function broadcastRealtimeEvent(eventType, payload) {
    const message = JSON.stringify({
        type: eventType,
        payload,
        timestamp: new Date().toISOString()
    });
    for (const client of clients) {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.send(message);
            }
            catch (err) {
                console.error('[Realtime] Failed to broadcast to client:', err);
            }
        }
    }
}
