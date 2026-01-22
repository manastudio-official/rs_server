import Admin from '../models/Admin.js';
import { successResponse, AppError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

// Register admin
export const registerAdmin = async (req, res, next) => {
  try {
    const { username, email, password, fullName, role, permissions } = req.body;

    // Check if this is the first admin
    const adminCount = await Admin.countDocuments();
    const isFirstAdmin = adminCount === 0;

    // If not first admin, check if requester is superadmin
    if (!isFirstAdmin && (!req.admin || req.admin.role !== 'superadmin')) {
      return next(new AppError('Only superadmins can create new admins', 403));
    }

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ $or: [{ email }, { username }] });
    if (existingAdmin) {
      return next(new AppError('Admin with this email or username already exists', 400));
    }

    // Set default permissions
    let adminPermissions = permissions || [];
    if (!adminPermissions.length) {
      if (role === 'superadmin' || isFirstAdmin) {
        adminPermissions = [
          'products_read', 'products_write', 'products_delete',
          'bookings_read', 'bookings_write', 'bookings_delete',
          'analytics_read', 'admins_manage'
        ];
      } else {
        adminPermissions = [
          'products_read', 'products_write',
          'bookings_read', 'bookings_write',
          'analytics_read'
        ];
      }
    }

    const admin = await Admin.create({
      username,
      email,
      password,
      fullName,
      role: isFirstAdmin ? 'superadmin' : (role || 'admin'),
      permissions: adminPermissions
    });

    const token = admin.getJWTToken();

    const cookieOptions = {
      expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('admin_token', token, cookieOptions);

    admin.password = undefined;

    logger.info(`New admin registered: ${admin.username} (${admin.email})`);

    successResponse(res, 201, { admin, token }, 'Admin registered successfully');
  } catch (error) {
    next(error);
  }
};

// Login admin
export const loginAdmin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return next(new AppError('Please provide username and password', 400));
    }

    const admin = await Admin.findOne({ 
      $or: [{ username }, { email: username }] 
    }).select('+password');

    if (!admin) {
      return next(new AppError('Invalid credentials', 401));
    }

    if (admin.isLocked) {
      const lockTime = Math.ceil((admin.lockUntil - Date.now()) / 1000 / 60);
      return next(new AppError(`Account is locked. Try again in ${lockTime} minutes`, 423));
    }

    if (!admin.isActive) {
      return next(new AppError('Account is deactivated. Contact superadmin', 403));
    }

    const isPasswordCorrect = await admin.comparePassword(password);

    if (!isPasswordCorrect) {
      await admin.incLoginAttempts();
      return next(new AppError('Invalid credentials', 401));
    }

    if (admin.loginAttempts > 0 || admin.lockUntil) {
      await admin.resetLoginAttempts();
    }

    admin.lastLogin = Date.now();
    await admin.save({ validateBeforeSave: false });

    const token = admin.getJWTToken();

    const cookieOptions = {
      expires: new Date(Date.now() + parseInt(process.env.JWT_COOKIE_EXPIRE) * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('admin_token', token, cookieOptions);

    admin.password = undefined;

    logger.info(`Admin login: ${admin.username}`);

    successResponse(res, 200, { admin, token }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

// Logout admin
export const logoutAdmin = async (req, res, next) => {
  try {
    res.cookie('admin_token', '', {
      expires: new Date(0),
      httpOnly: true
    });

    logger.info(`Admin logout: ${req.admin.username}`);

    successResponse(res, 200, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

// Get current admin
export const getCurrentAdmin = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return next(new AppError('Admin not found', 404));
    }

    successResponse(res, 200, admin);
  } catch (error) {
    next(error);
  }
};

// Update profile
export const updateAdminProfile = async (req, res, next) => {
  try {
    const { fullName, email } = req.body;

    const admin = await Admin.findById(req.admin.id);

    if (!admin) {
      return next(new AppError('Admin not found', 404));
    }

    if (fullName) admin.fullName = fullName;
    if (email) admin.email = email;

    await admin.save();

    admin.password = undefined;

    successResponse(res, 200, admin, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

// Change password
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new AppError('Please provide current and new password', 400));
    }

    const admin = await Admin.findById(req.admin.id).select('+password');

    if (!admin) {
      return next(new AppError('Admin not found', 404));
    }

    const isPasswordCorrect = await admin.comparePassword(currentPassword);

    if (!isPasswordCorrect) {
      return next(new AppError('Current password is incorrect', 401));
    }

    admin.password = newPassword;
    await admin.save();

    logger.info(`Password changed: ${admin.username}`);

    successResponse(res, 200, null, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

// Get all admins
export const getAllAdmins = async (req, res, next) => {
  try {
    const admins = await Admin.find().select('-password');

    successResponse(res, 200, admins);
  } catch (error) {
    next(error);
  }
};

// Update admin role
export const updateAdminRole = async (req, res, next) => {
  try {
    const { role, permissions, isActive } = req.body;
    const adminId = req.params.id;

    if (req.admin.id === adminId) {
      return next(new AppError('Cannot modify your own role or permissions', 400));
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return next(new AppError('Admin not found', 404));
    }

    if (role) admin.role = role;
    if (permissions) admin.permissions = permissions;
    if (typeof isActive !== 'undefined') admin.isActive = isActive;

    await admin.save();

    logger.info(`Admin updated: ${admin.username} by ${req.admin.username}`);

    admin.password = undefined;

    successResponse(res, 200, admin, 'Admin updated successfully');
  } catch (error) {
    next(error);
  }
};

// Delete admin
export const deleteAdmin = async (req, res, next) => {
  try {
    const adminId = req.params.id;

    if (req.admin.id === adminId) {
      return next(new AppError('Cannot delete your own account', 400));
    }

    const admin = await Admin.findById(adminId);

    if (!admin) {
      return next(new AppError('Admin not found', 404));
    }

    await admin.deleteOne();

    logger.info(`Admin deleted: ${admin.username} by ${req.admin.username}`);

    successResponse(res, 200, null, 'Admin deleted successfully');
  } catch (error) {
    next(error);
  }
};
