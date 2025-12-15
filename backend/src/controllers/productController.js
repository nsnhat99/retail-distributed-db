const Product = require('../models/Product');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    branch,
    search,
    minPrice,
    maxPrice,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    inStock
  } = req.query;

  // Build query
  const query = { isActive: true };

  // Filter by branch (staff chỉ xem branch của mình)
  if (req.user.role !== 'admin') {
    query.branch = req.user.branch;
  } else if (branch) {
    query.branch = branch;
  }

  // Filter by category
  if (category) {
    query.category = category;
  }

  // Filter by price range
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = parseFloat(minPrice);
    if (maxPrice) query.price.$lte = parseFloat(maxPrice);
  }

  // Filter by stock
  if (inStock === 'true') {
    query.stock = { $gt: 0 };
  }

  // Search by name or description (full-text search)
  if (search) {
    query.$text = { $search: search };
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Execute query
  const [products, total] = await Promise.all([
    Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    }
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
const getProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  res.json({
    success: true,
    data: { product }
  });
});

// @desc    Create product
// @route   POST /api/products
// @access  Private (Admin, Staff)
const createProduct = asyncHandler(async (req, res) => {
  const {
    sku,
    name,
    description,
    category,
    price,
    costPrice,
    stock,
    unit,
    branch,
    supplier,
    imageUrl
  } = req.body;

  // Staff chỉ được tạo product cho branch của mình
  const productBranch = req.user.role === 'admin' ? branch : req.user.branch;

  const product = await Product.create({
    sku,
    name,
    description,
    category,
    price,
    costPrice,
    stock,
    unit,
    branch: productBranch,
    supplier,
    imageUrl
  });

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'create_product',
    entityType: 'product',
    entityId: product._id,
    branch: product.branch,
    details: { sku: product.sku, name: product.name, price: product.price },
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: { product }
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Admin, Staff)
const updateProduct = asyncHandler(async (req, res) => {
  let product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Staff chỉ được update product của branch mình
  if (req.user.role !== 'admin' && product.branch !== req.user.branch) {
    throw new AppError('You can only update products in your branch', 403);
  }

  // Prevent changing branch (unless admin)
  if (req.user.role !== 'admin') {
    delete req.body.branch;
  }

  const oldData = {
    name: product.name,
    price: product.price,
    stock: product.stock
  };

  product = await Product.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'update_product',
    entityType: 'product',
    entityId: product._id,
    branch: product.branch,
    details: {
      sku: product.sku,
      changes: { old: oldData, new: { name: product.name, price: product.price, stock: product.stock } }
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: { product }
  });
});

// @desc    Delete product (soft delete)
// @route   DELETE /api/products/:id
// @access  Private (Admin, Staff)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Staff chỉ được delete product của branch mình
  if (req.user.role !== 'admin' && product.branch !== req.user.branch) {
    throw new AppError('You can only delete products in your branch', 403);
  }

  // Soft delete
  product.isActive = false;
  await product.save();

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'delete_product',
    entityType: 'product',
    entityId: product._id,
    branch: product.branch,
    details: { sku: product.sku, name: product.name },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
});

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Private
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category', { isActive: true });
  
  res.json({
    success: true,
    data: { categories }
  });
});

// @desc    Update stock
// @route   PATCH /api/products/:id/stock
// @access  Private (Admin, Staff)
const updateStock = asyncHandler(async (req, res) => {
  const { quantity, operation } = req.body; // operation: 'add' or 'subtract'

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Product not found', 404);
  }

  // Staff chỉ được update stock của branch mình
  if (req.user.role !== 'admin' && product.branch !== req.user.branch) {
    throw new AppError('You can only update stock in your branch', 403);
  }

  const oldStock = product.stock;

  if (operation === 'add') {
    product.stock += parseInt(quantity);
  } else if (operation === 'subtract') {
    if (product.stock < quantity) {
      throw new AppError('Insufficient stock', 400);
    }
    product.stock -= parseInt(quantity);
  } else {
    throw new AppError('Invalid operation. Use "add" or "subtract"', 400);
  }

  await product.save();

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'update_product',
    entityType: 'product',
    entityId: product._id,
    branch: product.branch,
    details: {
      sku: product.sku,
      stockChange: { operation, quantity, oldStock, newStock: product.stock }
    },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Stock updated successfully',
    data: { product }
  });
});

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  updateStock
};
