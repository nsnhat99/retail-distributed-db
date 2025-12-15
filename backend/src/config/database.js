const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 8 không cần các options này nữa, nhưng giữ để tương thích
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
