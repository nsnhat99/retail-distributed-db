const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { buildQueryWithAvailableBranches } = require('../middleware/shardFilter');
const { getUnavailableBranches } = require('../services/shardHealth');

// @desc    Get revenue statistics
// @route   GET /api/stats/revenue
// @access  Private (Admin, Staff)
const getRevenueStats = asyncHandler(async (req, res) => {
  const { startDate, endDate, branch, groupBy = 'day' } = req.query;

  // Build match stage with shard health awareness
  const branchResult = buildQueryWithAvailableBranches({
    status: 'completed',
    createdAt: {
      $gte: new Date(startDate || new Date().setMonth(new Date().getMonth() - 1)),
      $lte: new Date(endDate || new Date())
    }
  }, {
    userRole: req.user.role,
    userBranch: req.user.branch,
    requestedBranch: branch
  });

  if (branchResult.unavailable) {
    throw new AppError(branchResult.error, 503);
  }

  const matchStage = branchResult.query;

  // Group by configuration
  let groupByConfig;
  switch (groupBy) {
    case 'month':
      groupByConfig = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' }
      };
      break;
    case 'week':
      groupByConfig = {
        year: { $year: '$createdAt' },
        week: { $week: '$createdAt' }
      };
      break;
    case 'day':
    default:
      groupByConfig = {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' }
      };
  }

  const revenue = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: groupByConfig,
        totalRevenue: { $sum: '$finalAmount' },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: '$finalAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
  ]);

  // Calculate summary
  const summary = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$finalAmount' },
        totalOrders: { $sum: 1 },
        avgOrderValue: { $avg: '$finalAmount' },
        maxOrder: { $max: '$finalAmount' },
        minOrder: { $min: '$finalAmount' }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      revenue,
      summary: summary[0] || {
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0
      }
    }
  });
});

// @desc    Get top selling products
// @route   GET /api/stats/top-products
// @access  Private (Admin, Staff)
const getTopProducts = asyncHandler(async (req, res) => {
  const { limit = 10, branch, startDate, endDate } = req.query;

  // Build match stage with shard health awareness
  const baseQuery = { status: 'completed' };

  if (startDate || endDate) {
    baseQuery.createdAt = {};
    if (startDate) baseQuery.createdAt.$gte = new Date(startDate);
    if (endDate) baseQuery.createdAt.$lte = new Date(endDate);
  }

  const branchResult = buildQueryWithAvailableBranches(baseQuery, {
    userRole: req.user.role,
    userBranch: req.user.branch,
    requestedBranch: branch
  });

  if (branchResult.unavailable) {
    throw new AppError(branchResult.error, 503);
  }

  const matchStage = branchResult.query;

  const topProducts = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        sku: { $first: '$items.sku' },
        totalQuantitySold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.subtotal' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantitySold: -1 } },
    { $limit: parseInt(limit) }
  ]);

  res.json({
    success: true,
    data: { topProducts }
  });
});

// @desc    Get statistics by branch
// @route   GET /api/stats/by-branch
// @access  Private (Admin only)
const getStatsByBranch = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Build match stage - exclude unavailable branches
  const unavailableBranches = getUnavailableBranches();
  const matchStage = { status: 'completed' };

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  // Exclude unavailable branches - use $in for available branches to avoid querying down shards
  const availableBranches = ['hanoi', 'danang', 'hcm'].filter(
    b => !unavailableBranches.includes(b)
  );

  if (unavailableBranches.length > 0) {
    matchStage.branch = { $in: availableBranches };
  }

  const branchStats = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$branch',
        totalRevenue: { $sum: '$finalAmount' },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: '$finalAmount' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  // Get product count by branch - also filter by available branches
  const productMatchStage = { isActive: true };
  if (unavailableBranches.length > 0) {
    productMatchStage.branch = { $in: availableBranches };
  }

  const productsByBranch = await Product.aggregate([
    { $match: productMatchStage },
    {
      $group: {
        _id: '$branch',
        productCount: { $sum: 1 },
        totalStock: { $sum: '$stock' }
      }
    }
  ]);

  // Merge data
  const merged = branchStats.map(branch => {
    const productData = productsByBranch.find(p => p._id === branch._id) || {};
    return {
      ...branch,
      productCount: productData.productCount || 0,
      totalStock: productData.totalStock || 0
    };
  });

  res.json({
    success: true,
    data: { branchStats: merged },
    ...(unavailableBranches.length > 0 && {
      warning: `Một số chi nhánh không khả dụng: ${unavailableBranches.join(', ')}`,
      excludedBranches: unavailableBranches
    })
  });
});

// @desc    Get dashboard overview
// @route   GET /api/stats/dashboard
// @access  Private (Admin, Staff)
const getDashboardOverview = asyncHandler(async (req, res) => {
  const requestedBranch = req.user.role !== 'admin' ? req.user.branch : req.query.branch;

  // Check shard availability
  const branchResult = buildQueryWithAvailableBranches({}, {
    userRole: req.user.role,
    userBranch: req.user.branch,
    requestedBranch: requestedBranch
  });

  if (branchResult.unavailable) {
    throw new AppError(branchResult.error, 503);
  }

  // Date ranges
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Build match conditions with available branches filter
  const branchMatch = branchResult.query;

  // Today's stats
  const todayStats = await Order.aggregate([
    {
      $match: {
        ...branchMatch,
        status: 'completed',
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$finalAmount' },
        orders: { $sum: 1 }
      }
    }
  ]);

  // This month's stats
  const monthStats = await Order.aggregate([
    {
      $match: {
        ...branchMatch,
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$finalAmount' },
        orders: { $sum: 1 }
      }
    }
  ]);

  // Counts
  const [productCount, customerCount, staffCount] = await Promise.all([
    Product.countDocuments({ isActive: true, ...branchMatch }),
    User.countDocuments({ role: 'customer', isActive: true }),
    User.countDocuments({ role: 'staff', isActive: true, ...branchMatch })
  ]);

  // Low stock products
  const lowStockProducts = await Product.find({
    isActive: true,
    stock: { $lt: 10 },
    ...branchMatch
  })
    .select('sku name stock branch')
    .limit(5);

  // Recent orders
  const recentOrders = await Order.find(branchMatch)
    .sort({ createdAt: -1 })
    .limit(5)
    .select('orderCode customerName finalAmount status createdAt');

  // Recent activities
  const recentActivities = await Activity.find(branchMatch)
    .sort({ createdAt: -1 })
    .limit(10)
    .select('username action entityType createdAt');

  res.json({
    success: true,
    data: {
      today: todayStats[0] || { revenue: 0, orders: 0 },
      thisMonth: monthStats[0] || { revenue: 0, orders: 0 },
      counts: {
        products: productCount,
        customers: customerCount,
        staff: staffCount
      },
      lowStockProducts,
      recentOrders,
      recentActivities
    },
    ...(branchResult.warning && { warning: branchResult.warning }),
    ...(branchResult.excludedBranches && { excludedBranches: branchResult.excludedBranches })
  });
});

// @desc    Get sales by category
// @route   GET /api/stats/by-category
// @access  Private (Admin, Staff)
const getSalesByCategory = asyncHandler(async (req, res) => {
  const { startDate, endDate, branch } = req.query;

  const baseQuery = { status: 'completed' };

  if (startDate || endDate) {
    baseQuery.createdAt = {};
    if (startDate) baseQuery.createdAt.$gte = new Date(startDate);
    if (endDate) baseQuery.createdAt.$lte = new Date(endDate);
  }

  const branchResult = buildQueryWithAvailableBranches(baseQuery, {
    userRole: req.user.role,
    userBranch: req.user.branch,
    requestedBranch: branch
  });

  if (branchResult.unavailable) {
    throw new AppError(branchResult.error, 503);
  }

  const matchStage = branchResult.query;

  const categoryStats = await Order.aggregate([
    { $match: matchStage },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        totalRevenue: { $sum: '$items.subtotal' },
        totalQuantity: { $sum: '$items.quantity' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  res.json({
    success: true,
    data: { categoryStats }
  });
});

// @desc    Get activity logs
// @route   GET /api/stats/activities
// @access  Private (Admin)
const getActivityLogs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    action,
    branch,
    userId,
    startDate,
    endDate
  } = req.query;

  const query = {};

  if (action) query.action = action;
  if (branch) query.branch = branch;
  if (userId) query.userId = userId;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Activity.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      activities,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      }
    }
  });
});

module.exports = {
  getRevenueStats,
  getTopProducts,
  getStatsByBranch,
  getDashboardOverview,
  getSalesByCategory,
  getActivityLogs
};
