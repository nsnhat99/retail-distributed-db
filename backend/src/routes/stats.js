const express = require('express');
const router = express.Router();
const {
  getRevenueStats,
  getTopProducts,
  getStatsByBranch,
  getDashboardOverview,
  getSalesByCategory,
  getActivityLogs
} = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Routes accessible by admin and staff
router.get('/dashboard', getRevenueStats);
router.get('/overview', getDashboardOverview);
router.get('/revenue', getRevenueStats);
router.get('/top-products', getTopProducts);
router.get('/by-category', getSalesByCategory);

// Admin only routes
router.get('/by-branch', authorize('admin'), getStatsByBranch);
router.get('/activities', authorize('admin'), getActivityLogs);

module.exports = router;
