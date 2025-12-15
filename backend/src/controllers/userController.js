const User = require('../models/User');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin)
const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    role,
    branch,
    search,
    isActive
  } = req.query;

  // Build query
  const query = {};

  if (role) query.role = role;
  if (branch) query.branch = branch;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  // Search by name, username, or email
  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    }
  });
});

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin)
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: { user }
  });
});

// @desc    Create user (by Admin)
// @route   POST /api/users
// @access  Private (Admin)
const createUser = asyncHandler(async (req, res) => {
  const { username, password, fullName, email, phone, role, branch } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (existingUser) {
    throw new AppError('Username or email already exists', 400);
  }

  const user = await User.create({
    username,
    password,
    fullName,
    email,
    phone,
    role,
    branch
  });

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'create_user',
    entityType: 'user',
    entityId: user._id,
    branch: req.user.branch,
    details: { newUser: user.username, role: user.role, branch: user.branch },
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user }
  });
});

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUser = asyncHandler(async (req, res) => {
  const { fullName, email, phone, role, branch, isActive } = req.body;

  let user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Update fields
  user.fullName = fullName || user.fullName;
  user.email = email || user.email;
  user.phone = phone || user.phone;
  user.role = role || user.role;
  user.branch = branch || user.branch;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'update_user',
    entityType: 'user',
    entityId: user._id,
    branch: req.user.branch,
    details: { targetUser: user.username },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user }
  });
});

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private (Admin)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Prevent deleting self
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('Cannot delete your own account', 400);
  }

  // Soft delete
  user.isActive = false;
  await user.save();

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'delete_user',
    entityType: 'user',
    entityId: user._id,
    branch: req.user.branch,
    details: { deletedUser: user.username },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'User deleted successfully'
  });
});

// @desc    Reset user password (by Admin)
// @route   PATCH /api/users/:id/reset-password
// @access  Private (Admin)
const resetPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.password = newPassword;
  await user.save();

  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'update_user',
    entityType: 'user',
    entityId: user._id,
    branch: req.user.branch,
    details: { action: 'password_reset', targetUser: user.username },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Password reset successfully'
  });
});

// @desc    Get customers only
// @route   GET /api/users/customers
// @access  Private (Admin, Staff)
const getCustomers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search } = req.query;

  const query = { role: 'customer', isActive: true };

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [customers, total] = await Promise.all([
    User.find(query)
      .select('fullName phone email branch')
      .sort({ fullName: 1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(query)
  ]);

  res.json({
    success: true,
    data: {
      customers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total
      }
    }
  });
});

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getCustomers
};
