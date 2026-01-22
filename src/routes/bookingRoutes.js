import express from 'express';
import {
  createBooking,
  getBookingById,
  getAllBookings,
  updateBookingStatus,
  cancelBooking,
  getBookingStats
} from '../controllers/bookingController.js';
import { protect, optionalAuth, checkPermission } from '../middlewares/auth.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = express.Router();

const bookingValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phoneNumber').matches(/^[6-9]\d{9}$/).withMessage('Valid phone number is required'),
  body('address.pincode').matches(/^\d{6}$/).withMessage('Valid pincode is required'),
  body('products').isArray({ min: 1 }).withMessage('At least one product is required'),
  validate
];

// Public routes
router.post('/', bookingValidation, createBooking);
router.get('/:bookingId', optionalAuth, getBookingById);
router.post('/:bookingId/cancel', optionalAuth, cancelBooking);

// Admin only routes
router.get('/', protect, checkPermission('bookings_read'), getAllBookings);
router.get('/stats/overview', protect, checkPermission('analytics_read'), getBookingStats);
router.patch('/:bookingId/status', protect, checkPermission('bookings_write'), updateBookingStatus);

export default router;
