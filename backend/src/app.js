require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const statsRoutes = require('./routes/stats');
const userRoutes = require('./routes/users');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Retail Distributed DB API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'Login',
        'GET /api/auth/me': 'Get current user',
        'PUT /api/auth/password': 'Update password',
        'POST /api/auth/logout': 'Logout'
      },
      products: {
        'GET /api/products': 'Get all products',
        'GET /api/products/:id': 'Get single product',
        'POST /api/products': 'Create product',
        'PUT /api/products/:id': 'Update product',
        'DELETE /api/products/:id': 'Delete product',
        'PATCH /api/products/:id/stock': 'Update stock'
      },
      orders: {
        'GET /api/orders': 'Get all orders',
        'GET /api/orders/:id': 'Get single order',
        'POST /api/orders': 'Create order',
        'PATCH /api/orders/:id/status': 'Update order status',
        'DELETE /api/orders/:id': 'Cancel order'
      },
      stats: {
        'GET /api/stats/dashboard': 'Dashboard overview',
        'GET /api/stats/revenue': 'Revenue statistics',
        'GET /api/stats/top-products': 'Top selling products',
        'GET /api/stats/by-branch': 'Statistics by branch',
        'GET /api/stats/by-category': 'Sales by category'
      },
      users: {
        'GET /api/users': 'Get all users (Admin)',
        'GET /api/users/customers': 'Get customers',
        'POST /api/users': 'Create user (Admin)',
        'PUT /api/users/:id': 'Update user (Admin)',
        'DELETE /api/users/:id': 'Delete user (Admin)'
      }
    }
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║     Retail Distributed DB API Server          ║
╠═══════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}               ║
║  📊 Environment: ${process.env.NODE_ENV || 'development'}              ║
║  📝 API Docs: http://localhost:${PORT}/api       ║
╚═══════════════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Don't exit in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

module.exports = app;
