"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
router.get('/', authMiddleware_js_1.authenticateJWT, (0, authMiddleware_js_1.requireRole)(['admin']), (req, res) => {
    const logs = db_js_1.db.prepare(`
    SELECT a.*, u.full_name as actorName, u.email as actorEmail
    FROM audit_logs a
    LEFT JOIN user_profiles u ON u.id = a.actor_user_id
    ORDER BY a.timestamp DESC
    LIMIT 200
  `).all();
    res.json({ logs });
});
exports.default = router;
