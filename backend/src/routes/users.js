const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  getCustomers
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Validation middleware
const userValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  body('role')
    .isIn(['admin', 'staff', 'customer'])
    .withMessage('Invalid role'),
  body('branch')
    .isIn(['hanoi', 'danang', 'hcm'])
    .withMessage('Branch must be hanoi, danang, or hcm')
];

const passwordResetValidation = [
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
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

// Routes for staff (get customers for order creation)
router.get('/customers', authorize('admin', 'staff'), getCustomers);

// Admin only routes
router.get('/', authorize('admin'), getUsers);
router.get('/:id', authorize('admin'), getUser);
router.post('/', authorize('admin'), userValidation, validate, createUser);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);
router.patch('/:id/reset-password', authorize('admin'), passwordResetValidation, validate, resetPassword);

module.exports = router;
