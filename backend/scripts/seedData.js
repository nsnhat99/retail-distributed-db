/**
 * Seed Data Script
 * Tạo 500+ bản ghi mẫu cho hệ thống bán lẻ phân tán
 * 
 * Usage: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Models
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Activity = require('../src/models/Activity');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/retail_db';
const branches = ['hanoi', 'danang', 'hcm'];
const categories = ['electronics', 'clothing', 'food', 'furniture', 'books', 'sports', 'beauty', 'toys', 'other'];
const paymentMethods = ['cash', 'card', 'transfer', 'ewallet'];

// Sample data arrays
const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];
const middleNames = ['Văn', 'Thị', 'Đức', 'Minh', 'Thanh', 'Quốc', 'Hữu', 'Xuân', 'Thu', 'Hoàng'];
const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Giang', 'Hùng', 'Khoa', 'Linh', 'Mai', 'Nam', 'Phương', 'Quang', 'Sơn', 'Tâm', 'Tuấn', 'Vy', 'Yến'];

const productNames = {
  electronics: ['iPhone 15 Pro Max', 'Samsung Galaxy S24', 'MacBook Pro M3', 'iPad Air', 'AirPods Pro', 'Sony WH-1000XM5', 'Dell XPS 15', 'Xiaomi Redmi Note 13', 'Apple Watch Ultra', 'JBL Flip 6'],
  clothing: ['Áo thun nam Nike', 'Quần jean Levis 501', 'Váy đầm nữ Zara', 'Áo khoác Adidas', 'Áo sơ mi công sở', 'Quần short thể thao', 'Áo polo Lacoste', 'Váy maxi hè', 'Áo hoodie Uniqlo', 'Quần tây nam'],
  food: ['Gạo ST25 5kg', 'Nước mắm Phú Quốc', 'Dầu ăn Neptune 5L', 'Mì Hảo Hảo thùng', 'Sữa Vinamilk thùng', 'Cà phê Trung Nguyên', 'Bánh Oreo hộp', 'Nước ngọt Coca Cola', 'Trà xanh 0 độ', 'Snack Oishi'],
  furniture: ['Ghế gaming DXRacer', 'Bàn làm việc gỗ', 'Kệ sách 5 tầng', 'Giường ngủ 1m8', 'Tủ quần áo 3 cánh', 'Sofa phòng khách', 'Bàn ăn 6 ghế', 'Kệ tivi hiện đại', 'Ghế xoay văn phòng', 'Tủ giày'],
  books: ['Đắc Nhân Tâm', 'Nhà Giả Kim', 'Tư Duy Nhanh Chậm', 'Atomic Habits', 'Clean Code', 'Harry Potter Bộ', 'Doraemon Tập', 'Conan Tập', 'Sách IELTS', 'Từ điển Anh Việt'],
  sports: ['Vợt cầu lông Yonex', 'Bóng đá Mikasa', 'Giày chạy Nike', 'Găng tay boxing', 'Dây nhảy thể dục', 'Bộ tạ tay 10kg', 'Thảm yoga', 'Bóng rổ Spalding', 'Cầu lông Li Ning', 'Áo bóng đá CLB'],
  beauty: ['Son MAC Ruby Woo', 'Kem chống nắng Anessa', 'Nước hoa Chanel', 'Serum Vitamin C', 'Kem dưỡng da Laneige', 'Mascara Maybelline', 'Phấn phủ Innisfree', 'Tẩy trang Bioderma', 'Kem mắt SK-II', 'Sữa rửa mặt CeraVe'],
  toys: ['Lego Star Wars', 'Búp bê Barbie', 'Xe đua điều khiển', 'Rubik 3x3', 'Bộ xếp hình 1000 mảnh', 'Đồ chơi lắp ráp', 'Gấu bông Teddy', 'Máy bay mô hình', 'Bộ nấu ăn đồ chơi', 'Xe mô tô điện trẻ em'],
  other: ['Balo laptop', 'Ô tự động', 'Bình giữ nhiệt', 'Đèn bàn LED', 'Chuột không dây', 'Bàn phím cơ', 'Tai nghe gaming', 'Pin sạc dự phòng', 'Ốp lưng iPhone', 'Cáp sạc Type C']
};

// Helper functions
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(0);
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const generatePhone = () => {
  const prefixes = ['090', '091', '093', '094', '096', '097', '098', '086', '083', '084', '085', '088', '089'];
  return prefixes[randomInt(0, prefixes.length - 1)] + randomInt(1000000, 9999999);
};

const generateEmail = (name) => {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const cleanName = name.toLowerCase().replace(/\s+/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return `${cleanName}${randomInt(1, 999)}@${randomElement(domains)}`;
};

const generateFullName = () => {
  return `${randomElement(firstNames)} ${randomElement(middleNames)} ${randomElement(lastNames)}`;
};

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      Activity.deleteMany({})
    ]);

    // Hash password once
    const hashedPassword = await bcrypt.hash('123456', 10);

    // ========== 1. Create Users (100 users) ==========
    console.log('👥 Creating users...');
    const users = [];

    // Create admin accounts (3 - one per branch)
    for (const branch of branches) {
      users.push({
        username: `admin_${branch}`,
        password: hashedPassword,
        fullName: `Admin ${branch.charAt(0).toUpperCase() + branch.slice(1)}`,
        email: `admin_${branch}@retail.com`,
        phone: generatePhone(),
        role: 'admin',
        branch,
        isActive: true
      });
    }

    // Create staff accounts (15 - 5 per branch)
    for (const branch of branches) {
      for (let i = 1; i <= 5; i++) {
        const name = generateFullName();
        users.push({
          username: `staff_${branch}_${i}`,
          password: hashedPassword,
          fullName: name,
          email: generateEmail(name),
          phone: generatePhone(),
          role: 'staff',
          branch,
          isActive: true
        });
      }
    }

    // Create customer accounts (82 customers to reach ~100 total)
    for (let i = 1; i <= 82; i++) {
      const name = generateFullName();
      users.push({
        username: `customer_${i}`,
        password: hashedPassword,
        fullName: name,
        email: generateEmail(name),
        phone: generatePhone(),
        role: 'customer',
        branch: randomElement(branches),
        isActive: true
      });
    }

    const createdUsers = await User.insertMany(users);
    console.log(`   ✅ Created ${createdUsers.length} users`);

    // Separate users by role
    const admins = createdUsers.filter(u => u.role === 'admin');
    const staffs = createdUsers.filter(u => u.role === 'staff');
    const customers = createdUsers.filter(u => u.role === 'customer');

    // ========== 2. Create Products (200 products) ==========
    console.log('📦 Creating products...');
    const products = [];
    let skuCounter = 1;

    for (const category of categories) {
      const categoryProducts = productNames[category];
      for (const branch of branches) {
        for (const productName of categoryProducts) {
          const basePrice = randomFloat(50000, 50000000); // 50K - 50M VND
          products.push({
            sku: `SKU${String(skuCounter++).padStart(5, '0')}`,
            name: productName,
            description: `${productName} - Sản phẩm chất lượng cao, bảo hành 12 tháng`,
            category,
            price: basePrice,
            costPrice: Math.round(basePrice * 0.7),
            stock: randomInt(10, 500),
            unit: 'item',
            branch,
            supplier: `Supplier ${randomInt(1, 20)}`,
            isActive: true
          });
        }
      }
    }

    const createdProducts = await Product.insertMany(products);
    console.log(`   ✅ Created ${createdProducts.length} products`);

    // ========== 3. Create Orders (300 orders) ==========
    console.log('🧾 Creating orders...');
    const orders = [];
    const startDate = new Date('2024-01-01');
    const endDate = new Date();

    for (let i = 1; i <= 300; i++) {
      const branch = randomElement(branches);
      const branchStaffs = staffs.filter(s => s.branch === branch);
      const staff = randomElement(branchStaffs);
      const customer = randomElement(customers);
      
      // Random 1-5 items per order
      const itemCount = randomInt(1, 5);
      const branchProducts = createdProducts.filter(p => p.branch === branch && p.isActive);
      const selectedProducts = [];
      
      // Skip if no products for this branch
      if (branchProducts.length === 0) continue;
      
      for (let j = 0; j < itemCount; j++) {
        const product = randomElement(branchProducts);
        if (product && !selectedProducts.find(p => p.productId.toString() === product._id.toString())) {
          const quantity = randomInt(1, 3);
          selectedProducts.push({
            productId: product._id,
            sku: product.sku,
            productName: product.name,
            quantity,
            price: product.price,
            subtotal: product.price * quantity
          });
        }
      }

      // Skip if no products selected
      if (selectedProducts.length === 0) continue;

      const totalAmount = selectedProducts.reduce((sum, item) => sum + item.subtotal, 0);
      const discount = Math.random() > 0.7 ? Math.round(totalAmount * 0.05) : 0; // 30% chance of 5% discount
      const tax = Math.round(totalAmount * 0.1); // 10% tax
      const finalAmount = totalAmount - discount + tax;

      const orderDate = randomDate(startDate, endDate);
      const branchPrefix = { hanoi: 'HN', danang: 'DN', hcm: 'HCM' };
      const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');

      orders.push({
        orderCode: `${branchPrefix[branch]}-${dateStr}-${String(i).padStart(4, '0')}`,
        customerId: customer._id,
        customerName: customer.fullName,
        customerPhone: customer.phone,
        staffId: staff._id,
        branch,
        items: selectedProducts,
        totalAmount,
        discount,
        tax,
        finalAmount,
        paymentMethod: randomElement(paymentMethods),
        status: randomElement(['pending', 'confirmed', 'completed', 'completed', 'completed']), // 60% completed
        note: Math.random() > 0.8 ? 'Giao hàng nhanh' : '',
        createdAt: orderDate,
        updatedAt: orderDate
      });
    }

    const createdOrders = await Order.insertMany(orders);
    console.log(`   ✅ Created ${createdOrders.length} orders`);

    // ========== 4. Create Activities (200 logs) ==========
    console.log('📋 Creating activity logs...');
    const activities = [];
    const actions = ['login', 'create_order', 'update_product', 'view_report', 'create_product'];

    for (let i = 0; i < 200; i++) {
      const user = randomElement([...admins, ...staffs]);
      const action = randomElement(actions);
      
      activities.push({
        userId: user._id,
        username: user.username,
        action,
        entityType: action.includes('order') ? 'order' : action.includes('product') ? 'product' : 'system',
        branch: user.branch,
        details: { description: `${action} activity` },
        ipAddress: `192.168.1.${randomInt(1, 255)}`,
        createdAt: randomDate(startDate, endDate)
      });
    }

    const createdActivities = await Activity.insertMany(activities);
    console.log(`   ✅ Created ${createdActivities.length} activity logs`);

    // ========== Summary ==========
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              🎉 SEED DATA COMPLETED SUCCESSFULLY          ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  👥 Users:      ${createdUsers.length.toString().padStart(4)} (3 admin, 15 staff, 82 customers) ║`);
    console.log(`║  📦 Products:   ${createdProducts.length.toString().padStart(4)} (distributed across 3 branches)  ║`);
    console.log(`║  🧾 Orders:     ${createdOrders.length.toString().padStart(4)} (with various statuses)           ║`);
    console.log(`║  📋 Activities: ${createdActivities.length.toString().padStart(4)} (log entries)                    ║`);
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log('║  📌 Default password for all users: 123456                ║');
    console.log('║  📌 Admin accounts: admin_hanoi, admin_danang, admin_hcm  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    // Total records
    const total = createdUsers.length + createdProducts.length + createdOrders.length + createdActivities.length;
    console.log(`\n📊 Total records created: ${total}`);

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run seed
seedDatabase();
