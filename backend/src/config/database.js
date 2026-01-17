const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Cấu hình cho Sharded Cluster - xử lý failover
      readPreference: 'primaryPreferred', // Đọc từ primary, fallback sang secondary nếu primary tắt
      readConcern: { level: 'local' }, // Đọc data đã ghi nhận ở local, không đợi replication
      writeConcern: { w: 'majority', wtimeout: 5000 }, // Ghi vào majority nodes, timeout 5s
      serverSelectionTimeoutMS: 5000, // Timeout chọn server 5s thay vì 30s mặc định
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Log thông tin về replica set nếu có
    const admin = conn.connection.db.admin();
    try {
      const serverStatus = await admin.serverStatus();
      if (serverStatus.repl) {
        console.log(`📊 Replica Set: ${serverStatus.repl.setName}`);
        console.log(`📊 Is Primary: ${serverStatus.repl.ismaster}`);
      }
    } catch (err) {
      // Không phải replica set, bỏ qua
    }

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

module.exports = connectDB;
