const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  updateStock
} = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

// Validation middleware
const productValidation = [
  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required'),
  body('category')
    .isIn(['electronics', 'clothing', 'food', 'furniture', 'books', 'sports', 'beauty', 'toys', 'other'])
    .withMessage('Invalid category'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
];

const stockValidation = [
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('operation')
    .isIn(['add', 'subtract'])
    .withMessage('Operation must be "add" or "subtract"')
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
router.get('/categories', getCategories);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', authorize('admin', 'staff'), productValidation, validate, createProduct);
router.put('/:id', authorize('admin', 'staff'), updateProduct);
router.delete('/:id', authorize('admin', 'staff'), deleteProduct);
router.patch('/:id/stock', authorize('admin', 'staff'), stockValidation, validate, updateStock);

module.exports = router;
