const Order = require('../models/Order');
const Product = require('../models/Product');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { buildQueryWithAvailableBranches } = require('../middleware/shardFilter');

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

  // Build query with shard health awareness
  const branchResult = buildQueryWithAvailableBranches({}, {
    userRole: req.user.role,
    userBranch: req.user.branch,
    requestedBranch: branch
  });

  // If requested branch is unavailable, return error
  if (branchResult.unavailable) {
    throw new AppError(branchResult.error, 503);
  }

  const query = branchResult.query;

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
    },
    // Include warning if some branches are unavailable
    ...(branchResult.warning && { warning: branchResult.warning }),
    ...(branchResult.excludedBranches && { excludedBranches: branchResult.excludedBranches })
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
    note,
    branch: requestedBranch
  } = req.body;

  // Validate items
  if (!items || items.length === 0) {
    throw new AppError('Order must have at least one item', 400);
  }

  // Xác định branch cho order
  let branch;
  if (req.user.role === 'admin') {
    // Admin có branch cố định: dùng branch đó, hoặc cho phép chọn branch khác
    // Super admin (branch = null): bắt buộc phải chọn branch
    branch = requestedBranch || req.user.branch;
    if (!branch) {
      throw new AppError('Vui lòng chọn chi nhánh cho đơn hàng', 400);
    }
  } else {
    // Staff: chỉ được tạo order cho branch của mình
    branch = req.user.branch;
  }

  // Generate order code
  const orderCode = await Order.generateOrderCode(branch);

  // Process items và kiểm tra stock
  // Sử dụng shard key (branch) để query product, tránh broadcast query
  const processedItems = [];
  const queryOptions = { maxTimeMS: 5000 };

  for (const item of items) {
    // Query với branch để target đúng shard
    // Nếu product ở branch khác, sẽ fallback về findById
    let product = await Product.findOne(
      { _id: item.productId, branch },
      null,
      queryOptions
    );

    // Nếu không tìm thấy, thử query với branch khác (cho phép order sản phẩm từ chi nhánh khác)
    if (!product) {
      product = await Product.findById(item.productId).maxTimeMS(5000);
    }

    if (!product) {
      throw new AppError(`Không tìm thấy sản phẩm: ${item.productId}`, 404);
    }

    if (product.stock < item.quantity) {
      throw new AppError(`Không đủ hàng cho sản phẩm: ${product.name}. Còn lại: ${product.stock}`, 400);
    }

    processedItems.push({
      productId: product._id,
      productBranch: product.branch, // Lưu branch của product để deduct stock đúng shard
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

  // Tạo items cho order (không bao gồm productBranch vì schema không có)
  const orderItems = processedItems.map(item => ({
    productId: item.productId,
    sku: item.sku,
    productName: item.productName,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal
  }));

  // Create order - chỉ thêm customerId nếu có giá trị hợp lệ
  const orderData = {
    orderCode,
    customerName,
    customerPhone,
    staffId: req.user._id,
    branch,
    items: orderItems,
    totalAmount,
    discount,
    tax,
    finalAmount,
    paymentMethod,
    note,
    status: 'pending'
  };

  // Chỉ thêm customerId nếu có giá trị (không phải chuỗi rỗng)
  if (customerId && customerId.trim() !== '') {
    orderData.customerId = customerId;
  }

  const order = await Order.create(orderData);

  // Deduct stock - sử dụng shard key và không block nếu fail
  for (const item of processedItems) {
    try {
      await Product.findOneAndUpdate(
        { _id: item.productId, branch: item.productBranch },
        { $inc: { stock: -item.quantity } },
        { maxTimeMS: 5000 }
      );
    } catch (stockError) {
      // Nếu không thể cập nhật stock (shard product bị down), log warning nhưng không fail order
      console.warn(`Warning: Could not deduct stock for product ${item.sku}:`, stockError.message);
    }
  }

  // Log activity - không block nếu fail
  try {
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
  } catch (logError) {
    console.warn(`Warning: Could not log activity for order ${order.orderCode}:`, logError.message);
  }

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
  const { status, branch } = req.body;

  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  // Build query với shard key nếu có để tránh broadcast query
  let order;
  const queryOptions = { maxTimeMS: 5000 }; // 5 second timeout

  if (branch) {
    // Nếu có branch, query trực tiếp vào shard đó
    order = await Order.findOne({ _id: req.params.id, branch }, null, queryOptions);
  } else if (req.user.branch) {
    // Staff: chỉ query trong branch của mình
    order = await Order.findOne({ _id: req.params.id, branch: req.user.branch }, null, queryOptions);
  } else {
    // Super admin: phải broadcast query
    order = await Order.findById(req.params.id).maxTimeMS(5000);
  }

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Staff chỉ được update order của branch mình
  if (req.user.role !== 'admin' && order.branch !== req.user.branch) {
    throw new AppError('Access denied', 403);
  }

  // Nếu cancel, hoàn lại stock
  if (status === 'cancelled' && order.status !== 'cancelled') {
    try {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });
      }
    } catch (stockError) {
      // Nếu không thể cập nhật stock (shard product bị down), vẫn cho phép cancel order
      // Log warning nhưng không block operation
      console.warn(`Warning: Could not restore stock for order ${order.orderCode}:`, stockError.message);
    }
  }

  const oldStatus = order.status;
  order.status = status;

  try {
    await order.save();
  } catch (saveError) {
    // Nếu không thể save (shard down), throw lỗi rõ ràng
    console.error(`Error saving order ${order.orderCode}:`, saveError.message);
    throw saveError;
  }

  // Log activity - không block nếu fail
  try {
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
  } catch (logError) {
    console.warn(`Warning: Could not log activity for order ${order.orderCode}:`, logError.message);
  }

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
  const { branch } = req.body || {};

  // Build query với shard key nếu có để tránh broadcast query
  let order;
  const queryOptions = { maxTimeMS: 5000 };

  if (branch) {
    order = await Order.findOne({ _id: req.params.id, branch }, null, queryOptions);
  } else if (req.user.branch) {
    order = await Order.findOne({ _id: req.params.id, branch: req.user.branch }, null, queryOptions);
  } else {
    order = await Order.findById(req.params.id).maxTimeMS(5000);
  }

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
    try {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });
      }
    } catch (stockError) {
      // Nếu không thể cập nhật stock (shard product bị down), vẫn cho phép cancel order
      console.warn(`Warning: Could not restore stock for order ${order.orderCode}:`, stockError.message);
    }
  }

  order.status = 'cancelled';

  try {
    await order.save();
  } catch (saveError) {
    console.error(`Error saving cancelled order ${order.orderCode}:`, saveError.message);
    throw saveError;
  }

  // Log activity - không block nếu fail
  try {
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
  } catch (logError) {
    console.warn(`Warning: Could not log activity for cancelled order ${order.orderCode}:`, logError.message);
  }

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
