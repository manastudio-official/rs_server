import express from 'express';
import {
  registerAdmin,
  loginAdmin,
  logoutAdmin,
  getCurrentAdmin,
  updateAdminProfile,
  changePassword,
  getAllAdmins,
  updateAdminRole,
  deleteAdmin
} from '../controllers/authController.js';
import { protect, authorize, checkPermission, optionalAuth } from '../middlewares/auth.js';
import { authRateLimiter } from '../middlewares/rateLimiter.js';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation.js';

const router = express.Router();

const registerValidation = [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  validate
];

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

// Public routes (with rate limiting)
router.post('/register', authRateLimiter, optionalAuth, registerValidation, registerAdmin);
router.post('/login', authRateLimiter, loginValidation, loginAdmin);

// Protected routes
router.use(protect);

router.post('/logout', logoutAdmin);
router.get('/me', getCurrentAdmin);
router.put('/profile', updateAdminProfile);
router.put('/change-password', changePassword);

// Superadmin only routes
router.get('/admins', authorize('superadmin'), checkPermission('admins_manage'), getAllAdmins);
router.put('/admins/:id', authorize('superadmin'), checkPermission('admins_manage'), updateAdminRole);
router.delete('/admins/:id', authorize('superadmin'), checkPermission('admins_manage'), deleteAdmin);

export default router;
