import express from 'express';
import {
  getDashboardAnalytics,
  getSalesAnalytics,
  getInventoryAnalytics,
  getCustomerAnalytics,
  exportBookingsReport
} from '../controllers/adminController.js';
import { protect, checkPermission } from '../middlewares/auth.js';

const router = express.Router();

router.use(protect, checkPermission('analytics_read'));

router.get('/analytics/dashboard', getDashboardAnalytics);
router.get('/analytics/sales', getSalesAnalytics);
router.get('/analytics/inventory', getInventoryAnalytics);
router.get('/analytics/customers', getCustomerAnalytics);
router.get('/reports/bookings', exportBookingsReport);

export default router;
