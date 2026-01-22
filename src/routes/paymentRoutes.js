import express from 'express';
import {
  createRazorpayOrder,
  verifyPayment,
  handleRazorpayWebhook,
  getPaymentDetails,
  initiateRefund
} from '../controllers/paymentController.js';
import { protect, checkPermission } from '../middlewares/auth.js';
import { paymentRateLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// Public routes
router.post('/create-order', paymentRateLimiter, createRazorpayOrder);
router.post('/verify', verifyPayment);
router.post('/webhook', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

// Protected routes
router.use(protect);

router.get('/:paymentId', checkPermission('bookings_read'), getPaymentDetails);
router.post('/refund', checkPermission('bookings_write'), initiateRefund);

export default router;
