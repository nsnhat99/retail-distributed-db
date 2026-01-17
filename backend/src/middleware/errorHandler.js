// Centralized error handling middleware

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Async handler wrapper - tránh try-catch lặp lại
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log for development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    const message = messages.join('. ');
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }

  // Shard unavailable error (specific shard is down) - Kiểm tra trước để có message chi tiết
  if (err.message?.includes('Could not find host matching read preference')) {
    // Extract shard name from error message
    const shardMatch = err.message.match(/set (shard\d+RS)/);
    const shardName = shardMatch ? shardMatch[1] : 'unknown';

    // Mark shard as unavailable in health cache immediately
    try {
      const { markShardUnavailable } = require('../services/shardHealth');
      if (markShardUnavailable) {
        markShardUnavailable(shardName);
        console.log(`Marked ${shardName} as unavailable due to query error`);
      }
    } catch (e) {
      // Ignore if service not available
    }

    // Map shard to branch names
    const shardBranchMap = {
      'shard1RS': 'Hà Nội',
      'shard2RS': 'Đà Nẵng',
      'shard3RS': 'HCM'
    };

    const branchName = shardBranchMap[shardName] || shardName;
    const message = `Chi nhánh ${branchName} hiện không khả dụng. Vui lòng thử lại sau.`;

    error = new AppError(message, 503);
    error.shardUnavailable = true;
    error.affectedShard = shardName;
  }
  // Server Selection Timeout (khi MongoDB không tìm thấy server khả dụng)
  else if (err.message?.includes('Server selection timed out')) {
    // Try to extract shard info
    const shardMatch = err.message.match(/set (shard\d+RS)/);
    const shardName = shardMatch ? shardMatch[1] : null;

    if (shardName) {
      try {
        const { markShardUnavailable } = require('../services/shardHealth');
        if (markShardUnavailable) {
          markShardUnavailable(shardName);
        }
      } catch (e) {}

      const shardBranchMap = {
        'shard1RS': 'Hà Nội',
        'shard2RS': 'Đà Nẵng',
        'shard3RS': 'HCM'
      };
      const branchName = shardBranchMap[shardName] || shardName;
      error = new AppError(`Chi nhánh ${branchName} hiện không khả dụng (timeout). Vui lòng thử lại sau.`, 503);
    } else {
      error = new AppError('Dữ liệu tạm thời không khả dụng. Vui lòng thử lại sau.', 503);
    }
  }
  // MongoDB Connection/Network errors (khi shard không khả dụng)
  else if (err.name === 'MongoServerError' || err.name === 'MongoNetworkError') {
    // Try to extract shard info from error
    const shardMatch = err.message?.match(/set (shard\d+RS)/);
    const shardName = shardMatch ? shardMatch[1] : null;

    if (shardName) {
      try {
        const { markShardUnavailable } = require('../services/shardHealth');
        if (markShardUnavailable) {
          markShardUnavailable(shardName);
        }
      } catch (e) {}

      const shardBranchMap = {
        'shard1RS': 'Hà Nội',
        'shard2RS': 'Đà Nẵng',
        'shard3RS': 'HCM'
      };
      const branchName = shardBranchMap[shardName] || shardName;
      error = new AppError(`Chi nhánh ${branchName} hiện không khả dụng. Vui lòng thử lại sau.`, 503);
    } else {
      error = new AppError('Lỗi kết nối database. Một số dữ liệu tạm thời không khả dụng.', 503);
    }
  }
  // MongoDB Topology errors (khi không thể kết nối đến shard)
  else if (err.name === 'MongoTopologyClosedError' || err.message?.includes('topology')) {
    error = new AppError('Dịch vụ database tạm thời không khả dụng. Vui lòng thử lại sau.', 503);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Not found handler
const notFound = (req, res, next) => {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFound
};
