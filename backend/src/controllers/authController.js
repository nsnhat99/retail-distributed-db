const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public (hoặc Admin only tùy yêu cầu)
const register = asyncHandler(async (req, res) => {
  const { username, password, fullName, email, phone, role, branch } = req.body;

  // Kiểm tra user đã tồn tại
  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (existingUser) {
    throw new AppError('Username or email already exists', 400);
  }

  // Tạo user mới
  const user = await User.create({
    username,
    password,
    fullName,
    email,
    phone,
    role: role || 'customer',
    branch
  });

  // Generate token
  const token = generateToken(user._id);

  // Log activity
  await Activity.log({
    userId: user._id,
    username: user.username,
    action: 'create_user',
    entityType: 'user',
    entityId: user._id,
    branch: user.branch,
    details: { newUser: user.username, role: user.role },
    ipAddress: req.ip
  });

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branch: user.branch
      },
      token
    }
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    throw new AppError('Please provide username and password', 400);
  }

  // Find user và include password
  const user = await User.findOne({ username }).select('+password');

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check password
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated', 401);
  }

  // Generate token
  const token = generateToken(user._id);

  // Log activity
  await Activity.log({
    userId: user._id,
    username: user.username,
    action: 'login',
    entityType: 'user',
    entityId: user._id,
    branch: user.branch,
    details: { loginTime: new Date() },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        branch: user.branch
      },
      token
    }
  });
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        branch: user.branch,
        createdAt: user.createdAt
      }
    }
  });
});

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.userId).select('+password');

  // Check current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Generate new token
  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Password updated successfully',
    data: { token }
  });
});

// @desc    Logout (client-side token removal, log activity)
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  // Log activity
  await Activity.log({
    userId: req.user._id,
    username: req.user.username,
    action: 'logout',
    entityType: 'user',
    entityId: req.user._id,
    branch: req.user.branch,
    details: { logoutTime: new Date() },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = {
  register,
  login,
  getMe,
  updatePassword,
  logout
};
