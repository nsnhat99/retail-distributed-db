const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['electronics', 'clothing', 'food', 'furniture', 'books', 'sports', 'beauty', 'toys', 'other'],
    default: 'other'
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price cannot be negative'],
    default: 0
  },
  stock: {
    type: Number,
    required: [true, 'Stock is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  unit: {
    type: String,
    default: 'item',
    enum: ['item', 'kg', 'liter', 'box', 'pack']
  },
  branch: {
    type: String,
    enum: ['hanoi', 'danang', 'hcm'],
    required: [true, 'Branch is required']
  },
  supplier: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  imageUrl: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ branch: 1, category: 1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: 'text', description: 'text' }); // Full-text search

// Virtual for profit margin
productSchema.virtual('profitMargin').get(function() {
  if (this.costPrice === 0) return 100;
  return ((this.price - this.costPrice) / this.costPrice * 100).toFixed(2);
});

// Ensure virtuals are included in JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
