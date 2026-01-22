import Booking from '../models/Booking.js';
import Product from '../models/Product.js';
import { successResponse, AppError } from '../utils/apiResponse.js';
import { getAddressFromPincode } from '../utils/geocoding.js';
import logger from '../utils/logger.js';

// Create booking - PUBLIC
export const createBooking = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      products,
      orderTotal,
      notes
    } = req.body;

    // Auto-fetch city and state from pincode
    if (address.pincode) {
      const locationData = await getAddressFromPincode(address.pincode);
      if (locationData) {
        address.city = address.city || locationData.city;
        address.state = address.state || locationData.state;
        address.location = {
          type: 'Point',
          coordinates: locationData.coordinates,
          formattedAddress: locationData.formattedAddress
        };
      }
    }

    // Verify products and check stock
    const productIds = products.map(p => p.product);
    const dbProducts = await Product.find({ _id: { $in: productIds }, isActive: true });

    if (dbProducts.length !== products.length) {
      return next(new AppError('Some products not found or inactive', 404));
    }

    // Check stock availability
    for (const item of products) {
      const dbProduct = dbProducts.find(p => p._id.toString() === item.product);
      if (!dbProduct) {
        return next(new AppError(`Product not found`, 404));
      }
      if (dbProduct.stock < item.quantity) {
        return next(new AppError(`Insufficient stock for ${dbProduct.name}. Only ${dbProduct.stock} available`, 400));
      }
    }

    // Populate product details
    const bookingProducts = products.map(item => {
      const dbProduct = dbProducts.find(p => p._id.toString() === item.product);
      return {
        product: item.product,
        quantity: item.quantity,
        price: dbProduct.price,
        name: dbProduct.name,
        image: dbProduct.images[0]?.url || '',
        sku: dbProduct.sku
      };
    });

    // Calculate expected delivery (7 days from now)
    const expectedDelivery = new Date();
    expectedDelivery.setDate(expectedDelivery.getDate() + 7);

    const booking = await Booking.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      products: bookingProducts,
      orderTotal,
      notes,
      expectedDeliveryDate: expectedDelivery
    });

    logger.info(`Booking created: ${booking.bookingId} by ${email}`);

    successResponse(res, 201, booking, 'Booking created successfully');
  } catch (error) {
    next(error);
  }
};

// Get booking by ID - PUBLIC (with verification)
export const getBookingById = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { email, phoneNumber } = req.query;

    const query = { bookingId };

    // If not admin, require email or phone verification
    if (!req.admin) {
      if (!email && !phoneNumber) {
        return next(new AppError('Email or phone number required to view booking', 400));
      }

      if (email) query.email = email.toLowerCase();
      if (phoneNumber) query.phoneNumber = phoneNumber;
    }

    const booking = await Booking.findOne(query)
      .populate('products.product', 'name images sku');

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    successResponse(res, 200, booking);
  } catch (error) {
    next(error);
  }
};

// Get all bookings - ADMIN
export const getAllBookings = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};

    if (status) query.bookingStatus = status;
    if (paymentStatus) query['paymentInfo.paymentStatus'] = paymentStatus;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Search by booking ID, email, phone, name
    if (search) {
      query.$or = [
        { bookingId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .sort('-createdAt')
        .limit(parseInt(limit))
        .skip(skip)
        .populate('products.product', 'name images sku'),
      Booking.countDocuments(query)
    ]);

    successResponse(res, 200, {
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update booking status - ADMIN
export const updateBookingStatus = async (req, res, next) => {
  try {
    const { bookingStatus, note, trackingInfo, adminNotes } = req.body;

    const booking = await Booking.findOne({ bookingId: req.params.bookingId });

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    if (bookingStatus) {
      booking.bookingStatus = bookingStatus;
      
      booking.statusHistory.push({
        status: bookingStatus,
        timestamp: new Date(),
        note,
        updatedBy: req.admin.username
      });

      if (bookingStatus === 'delivered') {
        booking.deliveryDate = new Date();
      }

      if (bookingStatus === 'cancelled') {
        booking.cancelledAt = new Date();
        booking.cancellationReason = note;
        
        // Restore product stock
        for (const item of booking.products) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity }
          });
        }
      }
    }

    if (trackingInfo) {
      booking.trackingInfo = {
        ...booking.trackingInfo,
        ...trackingInfo,
        lastUpdate: new Date()
      };
    }

    if (adminNotes) {
      booking.adminNotes = adminNotes;
    }

    await booking.save();

    logger.info(`Booking updated: ${booking.bookingId} by ${req.admin.username}`);

    successResponse(res, 200, booking, 'Booking updated successfully');
  } catch (error) {
    next(error);
  }
};

// Cancel booking - PUBLIC or ADMIN
export const cancelBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { email, phoneNumber, reason } = req.body;

    const query = { bookingId };

    // If not admin, require verification
    if (!req.admin) {
      if (!email && !phoneNumber) {
        return next(new AppError('Email or phone number required', 400));
      }
      if (email) query.email = email.toLowerCase();
      if (phoneNumber) query.phoneNumber = phoneNumber;
    }

    const booking = await Booking.findOne(query);

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    // Can't cancel if already shipped or delivered
    if (['shipped', 'out_for_delivery', 'delivered'].includes(booking.bookingStatus)) {
      return next(new AppError('Cannot cancel booking in current status', 400));
    }

    booking.bookingStatus = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || 'Cancelled by customer';

    booking.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: reason,
      updatedBy: req.admin ? req.admin.username : 'customer'
    });

    // Restore product stock
    for (const item of booking.products) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity }
      });
    }

    await booking.save();

    logger.info(`Booking cancelled: ${booking.bookingId}`);

    successResponse(res, 200, booking, 'Booking cancelled successfully');
  } catch (error) {
    next(error);
  }
};

// Get booking statistics - ADMIN
export const getBookingStats = async (req, res, next) => {
  try {
    const stats = await Booking.aggregate([
      {
        $group: {
          _id: '$bookingStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const paymentStats = await Booking.aggregate([
      {
        $group: {
          _id: '$paymentInfo.paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$orderTotal.total' }
        }
      }
    ]);

    successResponse(res, 200, { bookingStats: stats, paymentStats });
  } catch (error) {
    next(error);
  }
};
