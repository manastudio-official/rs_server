import Product from '../models/Product.js';
import Booking from '../models/Booking.js';
import Admin from '../models/Admin.js';
import { successResponse } from '../utils/apiResponse.js';

// Dashboard analytics
export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const [
      totalProducts,
      activeProducts,
      lowStockProducts,
      totalBookings,
      pendingBookings,
      totalRevenue,
      todayRevenue,
      todayBookings,
      recentBookings,
      topProducts,
      bookingsByStatus,
      paymentsByMethod,
      revenueByMonth
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ stock: { $lte: 10 }, isActive: true }),
      
      Booking.countDocuments(dateFilter),
      Booking.countDocuments({ bookingStatus: 'pending', ...dateFilter }),
      
      Booking.aggregate([
        { $match: { 'paymentInfo.paymentStatus': 'paid', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$orderTotal.total' } } }
      ]),

      Booking.aggregate([
        { 
          $match: { 
            'paymentInfo.paymentStatus': 'paid',
            createdAt: { 
              $gte: new Date(new Date().setHours(0,0,0,0)) 
            }
          } 
        },
        { $group: { _id: null, total: { $sum: '$orderTotal.total' } } }
      ]),

      Booking.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
      }),
      
      Booking.find(dateFilter)
        .sort('-createdAt')
        .limit(10)
        .populate('products.product', 'name images')
        .select('bookingId firstName lastName email orderTotal paymentInfo bookingStatus createdAt'),
      
      Booking.aggregate([
        { $match: { 'paymentInfo.paymentStatus': 'paid', ...dateFilter } },
        { $unwind: '$products' },
        {
          $group: {
            _id: '$products.product',
            totalQuantity: { $sum: '$products.quantity' },
            totalRevenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDetails'
          }
        },
        { $unwind: '$productDetails' },
        {
          $project: {
            name: '$productDetails.name',
            sku: '$productDetails.sku',
            image: { $arrayElemAt: ['$productDetails.images.url', 0] },
            totalQuantity: 1,
            totalRevenue: 1
          }
        }
      ]),
      
      Booking.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$bookingStatus',
            count: { $sum: 1 }
          }
        }
      ]),

      Booking.aggregate([
        { $match: { 'paymentInfo.paymentStatus': 'paid', ...dateFilter } },
        {
          $group: {
            _id: '$paymentInfo.paymentMethod',
            count: { $sum: 1 },
            total: { $sum: '$orderTotal.total' }
          }
        }
      ]),
      
      Booking.aggregate([
        { $match: { 'paymentInfo.paymentStatus': 'paid' } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$orderTotal.total' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ])
    ]);

    const analytics = {
      summary: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        totalBookings,
        pendingBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
        todayRevenue: todayRevenue[0]?.total || 0,
        todayBookings
      },
      recentBookings,
      topProducts,
      bookingsByStatus,
      paymentsByMethod,
      revenueByMonth: revenueByMonth.map(item => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
        revenue: item.revenue,
        orders: item.orders
      }))
    };

    successResponse(res, 200, analytics);
  } catch (error) {
    next(error);
  }
};

// Sales analytics
export const getSalesAnalytics = async (req, res, next) => {
  try {
    const { period = '7days' } = req.query;

    let startDate = new Date();
    let groupByFormat = '%Y-%m-%d';

    switch (period) {
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        groupByFormat = '%Y-%m-%d';
        break;
      case '30days':
        startDate.setDate(startDate.getDate() - 30);
        groupByFormat = '%Y-%m-%d';
        break;
      case '12months':
        startDate.setMonth(startDate.getMonth() - 12);
        groupByFormat = '%Y-%m';
        break;
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        groupByFormat = '%Y-%m-%d %H:00';
        break;
    }

    const salesData = await Booking.aggregate([
      {
        $match: {
          'paymentInfo.paymentStatus': 'paid',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: groupByFormat, date: '$createdAt' }
          },
          totalSales: { $sum: '$orderTotal.total' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$orderTotal.total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    successResponse(res, 200, salesData);
  } catch (error) {
    next(error);
  }
};

// Inventory analytics
export const getInventoryAnalytics = async (req, res, next) => {
  try {
    const [
      lowStockProducts,
      outOfStockProducts,
      categoryDistribution,
      topSellingProducts,
      recentlyAddedProducts
    ] = await Promise.all([
      Product.find({ stock: { $lte: 10, $gt: 0 }, isActive: true })
        .select('name sku stock price images')
        .sort('stock')
        .limit(20),
      
      Product.find({ stock: 0, isActive: true })
        .select('name sku images price')
        .limit(20),
      
      Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalValue: { $sum: { $multiply: ['$price', '$stock'] } },
            totalStock: { $sum: '$stock' }
          }
        },
        { $sort: { count: -1 } }
      ]),

      Product.aggregate([
        { $match: { isActive: true } },
        { $sort: { views: -1 } },
        { $limit: 10 },
        {
          $project: {
            name: 1,
            sku: 1,
            stock: 1,
            price: 1,
            views: 1,
            image: { $arrayElemAt: ['$images.url', 0] }
          }
        }
      ]),

      Product.find({ isActive: true })
        .select('name sku stock price images createdAt')
        .sort('-createdAt')
        .limit(10)
    ]);

    successResponse(res, 200, {
      lowStockProducts,
      outOfStockProducts,
      categoryDistribution,
      topSellingProducts,
      recentlyAddedProducts
    });
  } catch (error) {
    next(error);
  }
};

// Customer analytics
export const getCustomerAnalytics = async (req, res, next) => {
  try {
    const [
      totalCustomers,
      topCustomers,
      customersByLocation,
      repeatCustomers
    ] = await Promise.all([
      Booking.distinct('email').then(emails => emails.length),
      
      Booking.aggregate([
        { $match: { 'paymentInfo.paymentStatus': 'paid' } },
        {
          $group: {
            _id: '$email',
            firstName: { $first: '$firstName' },
            lastName: { $first: '$lastName' },
            phoneNumber: { $first: '$phoneNumber' },
            totalSpent: { $sum: '$orderTotal.total' },
            orderCount: { $sum: 1 },
            lastOrder: { $max: '$createdAt' }
          }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 20 }
      ]),
      
      Booking.aggregate([
        {
          $group: {
            _id: '$address.state',
            count: { $sum: 1 },
            revenue: { $sum: '$orderTotal.total' }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      Booking.aggregate([
        {
          $group: {
            _id: '$email',
            orderCount: { $sum: 1 }
          }
        },
        {
          $match: { orderCount: { $gt: 1 } }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    successResponse(res, 200, {
      totalCustomers,
      repeatCustomers: repeatCustomers[0]?.count || 0,
      topCustomers,
      customersByLocation
    });
  } catch (error) {
    next(error);
  }
};

// Export bookings report
export const exportBookingsReport = async (req, res, next) => {
  try {
    const { startDate, endDate, status } = req.query;

    const query = {};
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (status) {
      query.bookingStatus = status;
    }

    const bookings = await Booking.find(query)
      .populate('products.product', 'name sku')
      .sort('-createdAt')
      .lean();

    // Format data for CSV export
    const csvData = bookings.map(booking => ({
      'Booking ID': booking.bookingId,
      'Date': new Date(booking.createdAt).toLocaleDateString('en-IN'),
      'Customer Name': `${booking.firstName} ${booking.lastName}`,
      'Email': booking.email,
      'Phone': booking.phoneNumber,
      'Products': booking.products.map(p => `${p.name} (${p.quantity})`).join('; '),
      'Total Amount': booking.orderTotal.total,
      'Payment Status': booking.paymentInfo.paymentStatus,
      'Booking Status': booking.bookingStatus,
      'City': booking.address.city,
      'State': booking.address.state
    }));

    successResponse(res, 200, csvData);
  } catch (error) {
    next(error);
  }
};
