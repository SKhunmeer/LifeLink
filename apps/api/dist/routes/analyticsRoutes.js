"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_js_1 = require("../db.js");
const router = (0, express_1.Router)();
router.get('/summary', (req, res) => {
    const totalUnitsAvailable = db_js_1.db.prepare(`
    SELECT COALESCE(SUM(units_count), 0) as total
    FROM blood_inventory
    WHERE status = 'available' AND date(expiry_date) >= date('now')
  `).get();
    const totalRequests = db_js_1.db.prepare('SELECT COUNT(*) as count FROM patient_requests').get();
    const fulfilledRequests = db_js_1.db.prepare('SELECT COUNT(*) as count FROM patient_requests WHERE status = \'fulfilled\'').get();
    const activeUrgentRequests = db_js_1.db.prepare(`
    SELECT COUNT(*) as count FROM patient_requests
    WHERE status NOT IN ('fulfilled', 'cancelled') AND urgency IN ('urgent', 'critical')
  `).get();
    const totalRegisteredDonors = db_js_1.db.prepare('SELECT COUNT(*) as count FROM donor_matching_profiles').get();
    const availableDonors = db_js_1.db.prepare('SELECT COUNT(*) as count FROM donor_matching_profiles WHERE is_available = 1 AND is_eligible = 1').get();
    const totalHospitals = db_js_1.db.prepare('SELECT COUNT(*) as count FROM hospitals').get();
    const fulfillmentRate = totalRequests.count > 0
        ? Math.round((fulfilledRequests.count / totalRequests.count) * 100)
        : 100;
    // Breakdown by component
    const componentDistribution = db_js_1.db.prepare(`
    SELECT component, SUM(units_count) as units
    FROM blood_inventory
    WHERE status = 'available' AND date(expiry_date) >= date('now')
    GROUP BY component
  `).all();
    // Stock status by blood group
    const bloodGroupDistribution = db_js_1.db.prepare(`
    SELECT blood_group as bloodGroup, SUM(units_count) as units
    FROM blood_inventory
    WHERE status = 'available' AND date(expiry_date) >= date('now')
    GROUP BY blood_group
  `).all();
    res.json({
        summary: {
            totalUnitsAvailable: totalUnitsAvailable.total,
            totalRequests: totalRequests.count,
            fulfilledRequests: fulfilledRequests.count,
            activeUrgentRequests: activeUrgentRequests.count,
            fulfillmentRate,
            totalRegisteredDonors: totalRegisteredDonors.count,
            availableDonors: availableDonors.count,
            totalHospitals: totalHospitals.count
        },
        componentDistribution,
        bloodGroupDistribution
    });
});
exports.default = router;
