import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import { initDatabase } from './db.js';
import { initRealtime } from './services/realtimeService.js';
import { apiLimiter } from './middleware/rateLimiter.js';

import authRoutes from './routes/authRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import donorRoutes from './routes/donorRoutes.js';
import hospitalRoutes from './routes/hospitalRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

// 1. Initialize relational database and seed data
initDatabase();

const app = express();
const server = http.createServer(app);

// 2. Initialize Realtime WebSocket hub
initRealtime(server);

// 3. Security & Parser Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

// 4. Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    product: 'BloodLink AI',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    twilioMode: process.env.TWILIO_ACCOUNT_SID ? 'live' : 'mock_sandbox',
    database: 'SQLite'
  });
});

const PORT = Number(process.env.PORT) || 4000;

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  BLOODLINK AI — CORE BACKEND API SERVER RUNNING   `);
  console.log(`  Port: http://localhost:${PORT}                    `);
  console.log(`  Health Check: http://localhost:${PORT}/api/health `);
  console.log(`  WebSocket Hub: ws://localhost:${PORT}/ws          `);
  console.log(`====================================================`);
});

export { app, server };
