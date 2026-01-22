import crypto from 'crypto';
import razorpayInstance from '../config/razorpay.js';
import Booking from '../models/Booking.js';
import Product from '../models/Product.js';
import { successResponse, AppError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

// Create Razorpay order
export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { bookingId, amount, currency = 'INR' } = req.body;

    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    // Verify amount matches booking total
    if (booking.orderTotal.total !== amount) {
      return next(new AppError('Amount mismatch', 400));
    }

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: bookingId,
      notes: {
        bookingId,
        customerEmail: booking.email,
        customerName: `${booking.firstName} ${booking.lastName}`
      }
    };

    const order = await razorpayInstance.orders.create(options);

    // Update booking with order ID
    booking.paymentInfo.razorpayOrderId = order.id;
    await booking.save();

    logger.info(`Razorpay order created: ${order.id} for booking ${bookingId}`);

    successResponse(res, 200, {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    }, 'Order created successfully');
  } catch (error) {
    logger.error('Razorpay order creation error:', error);
    next(error);
  }
};

// Verify payment
export const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      logger.error(`Payment verification failed for booking ${bookingId}`);
      return next(new AppError('Payment verification failed', 400));
    }

    // Update booking
    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    booking.paymentInfo.razorpayPaymentId = razorpay_payment_id;
    booking.paymentInfo.razorpaySignature = razorpay_signature;
    booking.paymentInfo.paymentStatus = 'paid';
    booking.paymentInfo.paidAt = new Date();
    booking.bookingStatus = 'confirmed';

    booking.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date(),
      note: 'Payment successful',
      updatedBy: 'system'
    });

    await booking.save();

    // Update product stock
    for (const item of booking.products) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    logger.info(`Payment verified: ${razorpay_payment_id} for booking ${bookingId}`);

    successResponse(res, 200, { booking }, 'Payment verified successfully');
  } catch (error) {
    logger.error('Payment verification error:', error);
    next(error);
  }
};

// Handle Razorpay webhook
export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.error('Invalid webhook signature');
      return next(new AppError('Invalid webhook signature', 400));
    }

    const event = req.body.event;
    const payload = req.body.payload.payment.entity;

    logger.info('Razorpay webhook event:', event);

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload);
        break;
      case 'refund.created':
        await handleRefundCreated(payload);
        break;
      default:
        logger.info('Unhandled webhook event:', event);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook error:', error);
    next(error);
  }
};

const handlePaymentCaptured = async (payload) => {
  const booking = await Booking.findOne({
    'paymentInfo.razorpayOrderId': payload.order_id
  });

  if (booking && booking.paymentInfo.paymentStatus !== 'paid') {
    booking.paymentInfo.paymentStatus = 'paid';
    booking.paymentInfo.razorpayPaymentId = payload.id;
    booking.paymentInfo.paidAt = new Date();
    booking.bookingStatus = 'confirmed';

    booking.statusHistory.push({
      status: 'confirmed',
      timestamp: new Date(),
      note: 'Payment captured via webhook',
      updatedBy: 'system'
    });

    await booking.save();

    // Update stock
    for (const item of booking.products) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }

    logger.info(`Payment captured via webhook: ${payload.id}`);
  }
};

const handlePaymentFailed = async (payload) => {
  const booking = await Booking.findOne({
    'paymentInfo.razorpayOrderId': payload.order_id
  });

  if (booking) {
    booking.paymentInfo.paymentStatus = 'failed';
    
    booking.statusHistory.push({
      status: 'payment_failed',
      timestamp: new Date(),
      note: 'Payment failed',
      updatedBy: 'system'
    });

    await booking.save();

    logger.info(`Payment failed via webhook: ${payload.id}`);
  }
};

const handleRefundCreated = async (payload) => {
  const booking = await Booking.findOne({
    'paymentInfo.razorpayPaymentId': payload.payment_id
  });

  if (booking) {
    booking.paymentInfo.paymentStatus = 'refunded';
    booking.paymentInfo.refundAmount = payload.amount / 100;
    booking.paymentInfo.refundedAt = new Date();

    await booking.save();

    logger.info(`Refund created via webhook: ${payload.id}`);
  }
};

// Get payment details - ADMIN
export const getPaymentDetails = async (req, res, next) => {
  try {
    const payment = await razorpayInstance.payments.fetch(req.params.paymentId);
    successResponse(res, 200, payment);
  } catch (error) {
    logger.error('Fetch payment error:', error);
    next(error);
  }
};

// Initiate refund - ADMIN
export const initiateRefund = async (req, res, next) => {
  try {
    const { bookingId, amount, reason } = req.body;

    const booking = await Booking.findOne({ bookingId });

    if (!booking) {
      return next(new AppError('Booking not found', 404));
    }

    if (booking.paymentInfo.paymentStatus !== 'paid') {
      return next(new AppError('Payment not completed for this booking', 400));
    }

    const refund = await razorpayInstance.payments.refund(
      booking.paymentInfo.razorpayPaymentId,
      {
        amount: amount ? Math.round(amount * 100) : undefined, // Full refund if no amount
        notes: {
          reason,
          bookingId
        }
      }
    );

    booking.paymentInfo.paymentStatus = amount ? 'partial_refund' : 'refunded';
    booking.paymentInfo.refundAmount = refund.amount / 100;
    booking.paymentInfo.refundReason = reason;
    booking.paymentInfo.refundedAt = new Date();

    await booking.save();

    logger.info(`Refund initiated: ${refund.id} for booking ${bookingId} by ${req.admin.username}`);

    successResponse(res, 200, refund, 'Refund initiated successfully');
  } catch (error) {
    logger.error('Refund error:', error);
    next(error);
  }
};
