const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderByCode
} = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

// Validation middleware
const orderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must have at least one item'),
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
];

const statusValidation = [
  body('status')
    .isIn(['pending', 'confirmed', 'completed', 'cancelled'])
    .withMessage('Invalid status')
];

// Middleware to handle validation errors
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(e => e.msg)
    });
  }
  next();
};

// All routes require authentication
router.use(authenticate);

// Routes
router.get('/', getOrders);
router.get('/code/:orderCode', getOrderByCode);
router.get('/:id', getOrder);
router.post('/', authorize('admin', 'staff'), orderValidation, validate, createOrder);
router.patch('/:id/status', authorize('admin', 'staff'), statusValidation, validate, updateOrderStatus);
router.delete('/:id', authorize('admin', 'staff'), cancelOrder);

module.exports = router;
