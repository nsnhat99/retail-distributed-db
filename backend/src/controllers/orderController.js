const Order = require('../models/Order');
const Product = require('../models/Product');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
const getOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    branch,
    status,
    startDate,
    endDate,
    customerId,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};

  // Filter by branch (staff chỉ xem branch của mình)
  if (req.user.role !== 'admin') {
    query.branch = req.user.branch;
  } else if (branch) {
    query.branch = branch;
  }

  // Filter by status
  if (status) {
    query.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  // Filter by customer
  if (customerId) {
    query.customerId = customerId;
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Execute query
  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('customerId', 'fullName phone')
      .populate('staffId', 'fullName')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    }
  });
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customerId', 'fullName phone email')
    .populate('staffId', 'fullName');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Staff chỉ xem order của branch mình
  if (req.user.role !== 'admin' && order.branch !== req.user.branch) {
    throw new AppError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { order }
  });
});

// @desc    Create order
// @route   POST /api/orders
// @access  Private (Admin, Staff)
const createOrder = asyncHandler(async (req, res) => {
  const {
    customerId,
    customerName,
    customerPhone,
    items,
    discount = 0,
    tax = 0,
    paymentMethod,
    note
  } = req.body;

  // Validate items
  if (!items || items.length === 0) {
    throw new AppError('Order must have at least one item', 400);
  }

  // Branch của order = branch của staff tạo order
  const branch = req.user.branch;

  // Generate order code
  const orderCode = await Order.generateOrderCode(branch);

  // Process items và kiểm tra stock
  const processedItems = [];
  
  for (const item of items) {
    const product = await Product.findById(item.productId);
    
    if (!product) {
      throw new AppError(`Product not found: ${item.productId}`, 404);
    }
    
    if (product.stock < item.quantity) {
      throw new AppError(`Insufficient stock for product: ${product.name}. Available: ${product.stock}`, 400);
    }

    processedItems.push({
      productId: product._id,
      sku: product.sku,
      productName: product.name,
      quantity: item.quantity,
      price: product.price,
      subtotal: product.price * item.quantity
    });
  }

  // Calculate totals
  const totalAmount = processedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const finalAmount = totalAmount - discount + tax;

  // Create order
  const order = await Order.create({
    orderCode,
    customerId,
    customerName,
    customerPhone,
    staffId: req.user._id,
    branch,
    items: processedItems,
    totalAmount,
    discount,
    tax,
    finalAmount,
    paymentMethod,
    note,
    status: 'pending'
  });

  // Deduct stock
  for (const item of processedItems) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: -item.quantity }
    });
  }

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'create_order',
    entityType: 'order',
    entityId: order._id,
    branch: order.branch,
    details: {
      orderCode: order.orderCode,
      totalAmount: order.finalAmount,
      itemCount: order.items.length
    },
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: { order }
  });
});

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private (Admin, Staff)
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  
  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Staff chỉ được update order của branch mình
  if (req.user.role !== 'admin' && order.branch !== req.user.branch) {
    throw new AppError('Access denied', 403);
  }

  // Nếu cancel, hoàn lại stock
  if (status === 'cancelled' && order.status !== 'cancelled') {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }
  }

  const oldStatus = order.status;
  order.status = status;
  await order.save();

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'update_order',
    entityType: 'order',
    entityId: order._id,
    branch: order.branch,
    details: {
      orderCode: order.orderCode,
      statusChange: { from: oldStatus, to: status }
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Order status updated successfully',
    data: { order }
  });
});

// @desc    Cancel order
// @route   DELETE /api/orders/:id
// @access  Private (Admin, Staff)
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Staff chỉ được cancel order của branch mình
  if (req.user.role !== 'admin' && order.branch !== req.user.branch) {
    throw new AppError('Access denied', 403);
  }

  // Không thể cancel order đã completed
  if (order.status === 'completed') {
    throw new AppError('Cannot cancel completed order', 400);
  }

  // Hoàn lại stock nếu chưa cancelled
  if (order.status !== 'cancelled') {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }
  }

  order.status = 'cancelled';
  await order.save();

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'cancel_order',
    entityType: 'order',
    entityId: order._id,
    branch: order.branch,
    details: { orderCode: order.orderCode },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: { order }
  });
});

// @desc    Get order by code
// @route   GET /api/orders/code/:orderCode
// @access  Private
const getOrderByCode = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderCode: req.params.orderCode })
    .populate('customerId', 'fullName phone email')
    .populate('staffId', 'fullName');

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Staff chỉ xem order của branch mình
  if (req.user.role !== 'admin' && order.branch !== req.user.branch) {
    throw new AppError('Access denied', 403);
  }

  res.json({
    success: true,
    data: { order }
  });
});

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderByCode
};
