import { Server as HttpServer } from 'http';
export declare function initRealtime(server: HttpServer): void;
export declare function broadcastRealtimeEvent(eventType: string, payload: any): void;
