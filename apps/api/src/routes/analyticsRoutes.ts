import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

router.get('/summary', (req, res) => {
  const totalUnitsAvailable = db.prepare(`
    SELECT COALESCE(SUM(units_count), 0) as total
    FROM blood_inventory
    WHERE status = 'available' AND date(expiry_date) >= date('now')
  `).get() as { total: number };

  const totalRequests = db.prepare('SELECT COUNT(*) as count FROM patient_requests').get() as { count: number };
  const fulfilledRequests = db.prepare('SELECT COUNT(*) as count FROM patient_requests WHERE status = \'fulfilled\'').get() as { count: number };
  const activeUrgentRequests = db.prepare(`
    SELECT COUNT(*) as count FROM patient_requests
    WHERE status NOT IN ('fulfilled', 'cancelled') AND urgency IN ('urgent', 'critical')
  `).get() as { count: number };

  const totalRegisteredDonors = db.prepare('SELECT COUNT(*) as count FROM donor_matching_profiles').get() as { count: number };
  const availableDonors = db.prepare('SELECT COUNT(*) as count FROM donor_matching_profiles WHERE is_available = 1 AND is_eligible = 1').get() as { count: number };
  const totalHospitals = db.prepare('SELECT COUNT(*) as count FROM hospitals').get() as { count: number };

  const fulfillmentRate = totalRequests.count > 0 
    ? Math.round((fulfilledRequests.count / totalRequests.count) * 100) 
    : 100;

  // Breakdown by component
  const componentDistribution = db.prepare(`
    SELECT component, SUM(units_count) as units
    FROM blood_inventory
    WHERE status = 'available' AND date(expiry_date) >= date('now')
    GROUP BY component
  `).all();

  // Stock status by blood group
  const bloodGroupDistribution = db.prepare(`
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

export default router;
