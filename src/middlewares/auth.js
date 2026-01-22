import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { AppError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // Extract token from header or cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    if (!token) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get admin from token
      req.admin = await Admin.findById(decoded.id).select('-password');
      
      if (!req.admin || !req.admin.isActive) {
        return next(new AppError('Admin no longer exists or is inactive', 401));
      }

      next();
    } catch (error) {
      logger.error('Token verification failed:', error.message);
      return next(new AppError('Invalid or expired token', 401));
    }
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return next(
        new AppError(
          `Role ${req.admin.role} is not authorized to access this route`, 
          403
        )
      );
    }
    next();
  };
};

export const checkPermission = (...requiredPermissions) => {
  return (req, res, next) => {
    // Superadmins have all permissions
    if (req.admin.role === 'superadmin') {
      return next();
    }

    const hasPermission = requiredPermissions.some(permission => 
      req.admin.permissions.includes(permission)
    );

    if (!hasPermission) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

// Optional auth - doesn't fail if no token
export const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.admin_token) {
      token = req.cookies.admin_token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = await Admin.findById(decoded.id).select('-password');
      } catch (error) {
        // Token invalid but continue
        logger.debug('Optional auth failed:', error.message);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
