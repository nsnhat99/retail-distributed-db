const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sku: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  subtotal: {
    type: Number,
    required: true
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderCode: {
    type: String,
    unique: true,
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  branch: {
    type: String,
    enum: ['hanoi', 'danang', 'hcm'],
    required: [true, 'Branch is required']
  },
  items: {
    type: [orderItemSchema],
    required: true,
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'Order must have at least one item'
    }
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  tax: {
    type: Number,
    default: 0
  },
  finalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'ewallet'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  note: {
    type: String,
    maxlength: [500, 'Note cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Indexes cho query và sharding
orderSchema.index({ orderCode: 1 }, { unique: true });
orderSchema.index({ branch: 1, createdAt: -1 }); // Shard key + time query
orderSchema.index({ customerId: 1 });
orderSchema.index({ staffId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

// Static method để generate order code
orderSchema.statics.generateOrderCode = async function(branch) {
  const branchPrefix = {
    hanoi: 'HN',
    danang: 'DN',
    hcm: 'HCM'
  };
  
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Đếm số order trong ngày của branch này
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  const count = await this.countDocuments({
    branch: branch,
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `${branchPrefix[branch]}-${dateStr}-${sequence}`;
};

// Pre-save middleware để tính toán finalAmount
orderSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('discount') || this.isModified('tax')) {
    this.totalAmount = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.finalAmount = this.totalAmount - this.discount + this.tax;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
