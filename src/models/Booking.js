import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^[6-9]\d{9}$/, 'Please provide a valid Indian phone number']
  },
  address: {
    streetOrApartment: {
      type: String,
      required: [true, 'Street/Apartment is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode']
    },
    country: {
      type: String,
      default: 'India'
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        default: [0, 0]
      },
      formattedAddress: String
    },
    landmark: String
  },
  products: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true
    },
    name: String,
    image: String,
    sku: String
  }],
  orderTotal: {
    subtotal: {
      type: Number,
      required: true
    },
    tax: {
      type: Number,
      default: 0
    },
    taxPercentage: {
      type: Number,
      default: 18
    },
    shipping: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    discountCode: String,
    total: {
      type: Number,
      required: true
    }
  },
  paymentInfo: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'partial_refund'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'upi', 'netbanking', 'wallet', 'cod'],
      default: 'card'
    },
    paidAt: Date,
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date
  },
  bookingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  deliveryDate: Date,
  expectedDeliveryDate: Date,
  notes: String,
  adminNotes: String,
  trackingInfo: {
    carrier: String,
    trackingNumber: String,
    trackingUrl: String,
    currentLocation: String,
    lastUpdate: Date
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: String
  }],
  cancellationReason: String,
  cancelledAt: Date,
  returnReason: String,
  returnedAt: Date
}, {
  timestamps: true
});

// Indexes
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ email: 1 });
bookingSchema.index({ phoneNumber: 1 });
bookingSchema.index({ 'paymentInfo.razorpayOrderId': 1 });
bookingSchema.index({ 'paymentInfo.paymentStatus': 1 });
bookingSchema.index({ bookingStatus: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ 'address.location': '2dsphere' });

// Generate booking ID before save
bookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    this.bookingId = `BK${timestamp}${random}`;
  }
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
