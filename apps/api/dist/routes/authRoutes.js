"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shared_1 = require("@bloodlink/shared");
const authService_js_1 = require("../services/authService.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const db_js_1 = require("../db.js");
const router = (0, express_1.Router)();
router.post('/register', rateLimiter_js_1.authLimiter, async (req, res) => {
    try {
        const parseResult = shared_1.RegisterSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: parseResult.error.errors[0].message });
        }
        const { user, token } = await (0, authService_js_1.registerUser)(parseResult.data);
        res.status(201).json({ user, token });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/login', rateLimiter_js_1.authLimiter, async (req, res) => {
    try {
        const parseResult = shared_1.LoginSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: parseResult.error.errors[0].message });
        }
        const { user, token } = await (0, authService_js_1.loginUser)(parseResult.data.email, parseResult.data.password);
        res.json({ user, token });
    }
    catch (error) {
        res.status(401).json({ error: error.message });
    }
});
router.get('/me', authMiddleware_js_1.authenticateJWT, (req, res) => {
    const user = (0, authService_js_1.getUserById)(req.user.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    // Enrich with role specific metadata
    let hospitalDetails = null;
    if (user.role === 'hospital_staff') {
        hospitalDetails = db_js_1.db.prepare(`
      SELECT hs.designation, hs.is_verified as staffVerified, h.*
      FROM hospital_staff hs
      JOIN hospitals h ON h.id = hs.hospital_id
      WHERE hs.user_id = ?
    `).get(user.id);
    }
    let donorDetails = null;
    if (user.role === 'donor') {
        donorDetails = db_js_1.db.prepare(`
      SELECT dmp.*, dpp.emergency_notification_consent, dpp.opt_out_status
      FROM donor_matching_profiles dmp
      JOIN donor_private_profiles dpp ON dpp.donor_uuid = dmp.donor_uuid
      WHERE dmp.user_id = ?
    `).get(user.id);
    }
    res.json({
        user,
        hospital: hospitalDetails,
        donor: donorDetails
    });
});
router.get('/demo-accounts', (req, res) => {
    const accounts = (0, authService_js_1.getAllDemoAccounts)();
    res.json({ accounts });
});
router.post('/switch-demo', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const user = (0, authService_js_1.getUserById)(userId);
    if (!user) {
        return res.status(404).json({ error: 'Demo user not found' });
    }
    const token = (0, authService_js_1.generateToken)({
        userId: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName
    });
    res.json({ user, token });
});
exports.default = router;
