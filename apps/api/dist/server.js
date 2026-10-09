"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db_js_1 = require("./db.js");
const realtimeService_js_1 = require("./services/realtimeService.js");
const rateLimiter_js_1 = require("./middleware/rateLimiter.js");
const authRoutes_js_1 = __importDefault(require("./routes/authRoutes.js"));
const inventoryRoutes_js_1 = __importDefault(require("./routes/inventoryRoutes.js"));
const requestRoutes_js_1 = __importDefault(require("./routes/requestRoutes.js"));
const donorRoutes_js_1 = __importDefault(require("./routes/donorRoutes.js"));
const hospitalRoutes_js_1 = __importDefault(require("./routes/hospitalRoutes.js"));
const notificationRoutes_js_1 = __importDefault(require("./routes/notificationRoutes.js"));
const auditRoutes_js_1 = __importDefault(require("./routes/auditRoutes.js"));
const analyticsRoutes_js_1 = __importDefault(require("./routes/analyticsRoutes.js"));
// 1. Initialize relational database and seed data
(0, db_js_1.initDatabase)();
const app = (0, express_1.default)();
exports.app = app;
const server = http_1.default.createServer(app);
exports.server = server;
// 2. Initialize Realtime WebSocket hub
(0, realtimeService_js_1.initRealtime)(server);
// 3. Security & Parser Middlewares
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api', rateLimiter_js_1.apiLimiter);
// 4. Register API Routes
app.use('/api/auth', authRoutes_js_1.default);
app.use('/api/inventory', inventoryRoutes_js_1.default);
app.use('/api/requests', requestRoutes_js_1.default);
app.use('/api/donors', donorRoutes_js_1.default);
app.use('/api/hospitals', hospitalRoutes_js_1.default);
app.use('/api/notifications', notificationRoutes_js_1.default);
app.use('/api/audit-logs', auditRoutes_js_1.default);
app.use('/api/analytics', analyticsRoutes_js_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        product: 'BloodLink AI',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        twilioMode: process.env.TWILIO_ACCOUNT_SID ? 'live' : 'mock_sandbox',
        database: 'PostgreSQL / SQLite Dual Engine'
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
