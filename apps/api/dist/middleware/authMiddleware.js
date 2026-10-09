"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJWT = authenticateJWT;
exports.requireRole = requireRole;
const authService_js_1 = require("../services/authService.js");
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = (0, authService_js_1.verifyToken)(token);
        if (payload) {
            req.user = payload;
            return next();
        }
    }
    return res.status(401).json({ error: 'Authentication required. Invalid or expired token.' });
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Access forbidden. Required role: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}.`
            });
        }
        next();
    };
}
