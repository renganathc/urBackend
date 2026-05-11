const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  getOverview,
  getActivationFunnel,
  getCohorts,
  getFeatureUsage,
  getReliability,
  getTopProjects,
  getChurnSignals,
} = require('../controllers/admin.metrics.controller');

// All admin routes require a valid dashboard session.
// The controller's requireAdmin() guard enforces isAdmin=true.
router.get('/overview', authMiddleware, getOverview);
router.get('/activation-funnel', authMiddleware, getActivationFunnel);
router.get('/cohorts', authMiddleware, getCohorts);
router.get('/feature-usage', authMiddleware, getFeatureUsage);
router.get('/reliability', authMiddleware, getReliability);
router.get('/top-projects', authMiddleware, getTopProjects);
router.get('/churn-signals', authMiddleware, getChurnSignals);

module.exports = router;
