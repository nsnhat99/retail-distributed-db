const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'create_product',
      'update_product',
      'delete_product',
      'create_order',
      'update_order',
      'cancel_order',
      'create_user',
      'update_user',
      'delete_user',
      'view_report',
      'export_data',
      'other'
    ]
  },
  entityType: {
    type: String,
    enum: ['user', 'product', 'order', 'report', 'system', 'other']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  branch: {
    type: String,
    enum: ['hanoi', 'danang', 'hcm', null],
    default: null
  },
  details: {
    type: mongoose.Schema.Types.Mixed // Flexible field cho thông tin chi tiết
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ branch: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });

// TTL Index - tự động xóa log sau 90 ngày
activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static method để ghi log
activitySchema.statics.log = async function(data) {
  try {
    const activity = new this(data);
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Activity logging error:', error);
    // Không throw error để không ảnh hưởng đến flow chính
    return null;
  }
};

module.exports = mongoose.model('Activity', activitySchema);
