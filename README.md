# 🛒 Hệ Thống Quản Lý Bán Lẻ Phân Tán

## Hệ thống quản lý bán hàng sử dụng MongoDB Sharded Cluster

> **Môn học:** Cơ sở dữ liệu phân tán  
> **Công nghệ:** MongoDB 7.0, Node.js, React, Docker

---

## 📋 Mục Lục

1. [Tổng Quan Hệ Thống](#-tổng-quan-hệ-thống)
2. [Yêu Cầu Cài Đặt](#-yêu-cầu-cài-đặt)
3. [Hướng Dẫn Cài Đặt Chi Tiết](#-hướng-dẫn-cài-đặt-chi-tiết)
4. [Kiến Trúc Hệ Thống](#-kiến-trúc-hệ-thống)
5. [Tính Năng Đáp Ứng Yêu Cầu Đề Bài](#-tính-năng-đáp-ứng-yêu-cầu-đề-bài)
6. [Demo Failover](#-demo-failover)
7. [Tài Khoản Demo](#-tài-khoản-demo)
8. [API Endpoints](#-api-endpoints)
9. [Xử Lý Sự Cố](#-xử-lý-sự-cố)

---

## 🎯 Tổng Quan Hệ Thống

Hệ thống quản lý bán lẻ phân tán với 3 chi nhánh:
- **Hà Nội** (Shard 1)
- **Đà Nẵng** (Shard 2)  
- **TP. Hồ Chí Minh** (Shard 3)

### Tính năng chính:
- ✅ Lưu trữ hóa đơn, sản phẩm, khách hàng, lịch sử giao dịch
- ✅ Phân tích số liệu bán hàng theo ngày – tuần – tháng
- ✅ Hệ thống phân tán đảm bảo chịu tải cao vào giờ cao điểm
- ✅ Tối ưu write-heavy workload

---

## 💻 Yêu Cầu Cài Đặt

### Phần mềm cần cài:

| Phần mềm | Phiên bản | Link tải |
|----------|-----------|----------|
| **Docker Desktop** | Latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js** | 18+ LTS | [nodejs.org](https://nodejs.org/) |

### Cấu hình máy tối thiểu:
- RAM: 8GB (khuyến nghị 16GB)
- Disk: 10GB trống
- OS: Windows 10/11

---

## 🚀 Hướng Dẫn Cài Đặt Chi Tiết

### Bước 1: Cài đặt Docker Desktop

1. Tải Docker Desktop từ [docker.com](https://www.docker.com/products/docker-desktop/)
2. Cài đặt và **khởi động lại máy tính**
3. Mở Docker Desktop, chờ đến khi hiện **"Docker Desktop is running"**
4. Kiểm tra trong PowerShell:
```powershell
docker --version
# Kết quả: Docker version 24.x.x
```

### Bước 2: Cài đặt Node.js

1. Tải Node.js LTS từ [nodejs.org](https://nodejs.org/)
2. Cài đặt với cấu hình mặc định
3. Kiểm tra trong PowerShell:
```powershell
node --version
# Kết quả: v18.x.x hoặc v20.x.x

npm --version
# Kết quả: 9.x.x hoặc 10.x.x
```

### Bước 3: Giải nén Project

```powershell
# Giải nén file retail-distributed-db.zip vào thư mục mong muốn
# Ví dụ: D:\Projects\retail-distributed-db
```

### Bước 4: Khởi động MongoDB Cluster

```powershell
# Mở PowerShell và vào thư mục docker
cd D:\Projects\retail-distributed-db\docker

# Khởi động các containers
docker compose up -d

# Chờ 15 giây để containers khởi động hoàn tất. Sau đó kiểm tra containers đang chạy
docker ps
```

**Kết quả mong đợi:** 5 containers đang chạy:
- configsvr
- shard1
- shard2
- shard3
- mongos

### Bước 5: Khởi tạo Cluster (QUAN TRỌNG)

Chạy **từng lệnh một** trong PowerShell:

```powershell
# 5.1 - Khởi tạo Config Server
docker exec configsvr mongosh --eval "rs.initiate({_id:'configRS',configsvr:true,members:[{_id:0,host:'configsvr:27017'}]})"
```

Chờ 5 giây...

```powershell
# 5.2 - Khởi tạo Shard 1 (Hà Nội)
docker exec shard1 mongosh --eval "rs.initiate({_id:'shard1RS',members:[{_id:0,host:'shard1:27017'}]})"

# 5.3 - Khởi tạo Shard 2 (Đà Nẵng)
docker exec shard2 mongosh --eval "rs.initiate({_id:'shard2RS',members:[{_id:0,host:'shard2:27017'}]})"

# 5.4 - Khởi tạo Shard 3 (TP.HCM)
docker exec shard3 mongosh --eval "rs.initiate({_id:'shard3RS',members:[{_id:0,host:'shard3:27017'}]})"
```

Chờ 5 giây...

```powershell
# 5.5 - Thêm Shards vào Cluster
docker exec mongos mongosh --eval "sh.addShard('shard1RS/shard1:27017')"
docker exec mongos mongosh --eval "sh.addShard('shard2RS/shard2:27017')"
docker exec mongos mongosh --eval "sh.addShard('shard3RS/shard3:27017')"
```

```powershell
# 5.6 - Enable Sharding cho Database
docker exec mongos mongosh --eval "sh.enableSharding('retail_db')"

# 5.7 - Shard các Collections theo branch
docker exec mongos mongosh --eval "sh.shardCollection('retail_db.products', {branch:1,_id:1})"
docker exec mongos mongosh --eval "sh.shardCollection('retail_db.orders', {branch:1,_id:1})"
docker exec mongos mongosh --eval "sh.shardCollection('retail_db.activities', {branch:1,_id:1})"
```

### Bước 6: Cấu hình Zone Sharding (Phân vùng theo chi nhánh)

```powershell
# 6.1 - Gán Tag cho từng Shard
docker exec mongos mongosh --eval "sh.addShardTag('shard1RS', 'hanoi')"
docker exec mongos mongosh --eval "sh.addShardTag('shard2RS', 'danang')"
docker exec mongos mongosh --eval "sh.addShardTag('shard3RS', 'hcm')"

# 6.2 - Gán Zone Range cho Products
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.products', {branch:'hanoi',_id:MinKey()}, {branch:'hanoi',_id:MaxKey()}, 'hanoi')"
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.products', {branch:'danang',_id:MinKey()}, {branch:'danang',_id:MaxKey()}, 'danang')"
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.products', {branch:'hcm',_id:MinKey()}, {branch:'hcm',_id:MaxKey()}, 'hcm')"

# 6.3 - Gán Zone Range cho Orders
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.orders', {branch:'hanoi',_id:MinKey()}, {branch:'hanoi',_id:MaxKey()}, 'hanoi')"
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.orders', {branch:'danang',_id:MinKey()}, {branch:'danang',_id:MaxKey()}, 'danang')"
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.orders', {branch:'hcm',_id:MinKey()}, {branch:'hcm',_id:MaxKey()}, 'hcm')"

# 6.4 - Gán Zone Range cho Activities
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.activities', {branch:'hanoi',_id:MinKey()}, {branch:'hanoi',_id:MaxKey()}, 'hanoi')"
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.activities', {branch:'danang',_id:MinKey()}, {branch:'danang',_id:MaxKey()}, 'danang')"
docker exec mongos mongosh --eval "sh.addTagRange('retail_db.activities', {branch:'hcm',_id:MinKey()}, {branch:'hcm',_id:MaxKey()}, 'hcm')"
```

### Bước 7: Kiểm tra Cluster Status

```powershell
docker exec mongos mongosh --eval "sh.status()"
```

**Kết quả mong đợi:**
- 3 shards với tags: hanoi, danang, hcm
- Database retail_db đã được sharding
- Collections products, orders, activities đã có shard key

### Bước 8: Chạy Backend

Mở **PowerShell mới** (Terminal 1):

```powershell
# Vào thư mục backend
cd D:\Projects\retail-distributed-db\backend

# Cài đặt dependencies
npm install

# Tạo dữ liệu mẫu (500+ records)
npm run seed

# Khởi động server
npm run dev
```

**Kết quả mong đợi:**
```
🌱 Seeding database...
👤 Creating users...
📦 Creating products...
🧾 Creating orders...
📋 Creating activities...
✅ Seed completed!
   - Users: 100
   - Products: 270
   - Orders: 300
   - Activities: 200

🚀 Server running on port 5000
📊 MongoDB connected
```

### Bước 9: Chạy Frontend

Mở **PowerShell mới** (Terminal 2):

```powershell
# Vào thư mục frontend
cd D:\Projects\retail-distributed-db\frontend

# Cài đặt dependencies
npm install

# Khởi động React app
npm run dev
```

**Kết quả mong đợi:**
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

### Bước 10: Truy cập Hệ Thống

1. Mở trình duyệt: **http://localhost:5173**
2. Đăng nhập với tài khoản: `admin_hanoi` / `123456`
3. Khám phá các tính năng!

---

## 🏗 Kiến Trúc Hệ Thống

```
                         ┌─────────────────────┐
                         │   React Frontend    │
                         │   localhost:5173    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Node.js Backend   │
                         │   localhost:5000    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Mongos Router     │
                         │   localhost:27017   │
                         └──────────┬──────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│   Shard 1     │         │   Shard 2     │         │   Shard 3     │
│   (Hà Nội)    │         │  (Đà Nẵng)    │         │   (TP.HCM)    │
│  port 27101   │         │  port 27102   │         │  port 27103   │
│               │         │               │         │               │
│ branch='hanoi'│         │branch='danang'│         │ branch='hcm'  │
└───────────────┘         └───────────────┘         └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Config Server     │
                         │   port 27100        │
                         │  (Lưu metadata)     │
                         └─────────────────────┘
```

### Giải thích các thành phần:

| Thành phần | Port | Chức năng |
|------------|------|-----------|
| **React Frontend** | 5173 | Giao diện người dùng |
| **Node.js Backend** | 5000 | API REST server |
| **Mongos Router** | 27017 | Điều phối queries đến đúng shard |
| **Config Server** | 27100 | Lưu metadata của cluster |
| **Shard 1** | 27101 | Lưu data chi nhánh Hà Nội |
| **Shard 2** | 27102 | Lưu data chi nhánh Đà Nẵng |
| **Shard 3** | 27103 | Lưu data chi nhánh TP.HCM |

---

## 📊 Tính Năng Đáp Ứng Yêu Cầu Đề Bài

### 1️⃣ Lưu trữ hóa đơn, sản phẩm, khách hàng, lịch sử giao dịch

| Yêu cầu | Collection | File Model |
|---------|------------|------------|
| Hóa đơn | `orders` | `backend/src/models/Order.js` |
| Sản phẩm | `products` | `backend/src/models/Product.js` |
| Khách hàng | `users` (role=customer) | `backend/src/models/User.js` |
| Lịch sử giao dịch | `activities` | `backend/src/models/Activity.js` |

**Code mẫu - Order Schema:**
```javascript
// backend/src/models/Order.js
const orderSchema = new mongoose.Schema({
  orderCode: { type: String, unique: true },
  customerId: { ref: 'User' },
  branch: { enum: ['hanoi', 'danang', 'hcm'] },
  items: [{
    productId, productName, quantity, price, subtotal
  }],
  totalAmount, discount, tax, finalAmount,
  paymentMethod: { enum: ['cash', 'card', 'transfer', 'ewallet'] },
  status: { enum: ['pending', 'confirmed', 'completed', 'cancelled'] }
}, { timestamps: true });
```

### 2️⃣ Phân tích số liệu bán hàng theo ngày – tuần – tháng

**File:** `backend/src/controllers/statsController.js`

**API Endpoints:**
```
GET /api/stats/revenue?groupBy=day      # Theo ngày
GET /api/stats/revenue?groupBy=week     # Theo tuần
GET /api/stats/revenue?groupBy=month    # Theo tháng
GET /api/stats/top-products             # Top sản phẩm bán chạy
GET /api/stats/by-branch                # Thống kê theo chi nhánh
GET /api/stats/by-category              # Thống kê theo danh mục
```

**Code mẫu - Aggregation Pipeline:**
```javascript
// backend/src/controllers/statsController.js
const getRevenueStats = async (req, res) => {
  const { groupBy = 'day' } = req.query;
  
  let groupByConfig;
  switch (groupBy) {
    case 'month':
      groupByConfig = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
      break;
    case 'week':
      groupByConfig = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
      break;
    default: // day
      groupByConfig = { 
        year: { $year: '$createdAt' }, 
        month: { $month: '$createdAt' }, 
        day: { $dayOfMonth: '$createdAt' } 
      };
  }

  const revenue = await Order.aggregate([
    { $match: { status: 'completed' } },
    { $group: {
        _id: groupByConfig,
        totalRevenue: { $sum: '$finalAmount' },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: '$finalAmount' }
    }},
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);
};
```

### 3️⃣ Hệ thống phân tán đảm bảo chịu tải cao vào giờ cao điểm

**Giải pháp:** MongoDB Sharded Cluster với Zone Sharding

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARDING STRATEGY                        │
├─────────────────────────────────────────────────────────────┤
│  Shard Key: { branch: 1, _id: 1 }                          │
│                                                             │
│  Zone Mapping:                                              │
│    branch = 'hanoi'  → Shard 1 (tag: hanoi)                │
│    branch = 'danang' → Shard 2 (tag: danang)               │
│    branch = 'hcm'    → Shard 3 (tag: hcm)                  │
│                                                             │
│  Lợi ích:                                                   │
│    ✅ Data locality: Query chi nhánh nào → đến shard đó    │
│    ✅ Parallel writes: 3 chi nhánh ghi đồng thời           │
│    ✅ Horizontal scaling: Thêm shard khi cần               │
└─────────────────────────────────────────────────────────────┘
```

**Kiểm tra phân bố data:**
```powershell
docker exec mongos mongosh --eval "sh.status()"
```

### 4️⃣ Tối ưu write-heavy workload

| Kỹ thuật | Mô tả | Code |
|----------|-------|------|
| **Compound Indexes** | Index trên các field thường query | `orderSchema.index({ branch: 1, createdAt: -1 })` |
| **TTL Index** | Tự động xóa logs cũ sau 90 ngày | `activitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90*24*60*60 })` |
| **Bulk Insert** | Chèn nhiều documents 1 lần | `await Order.insertMany(orders)` |
| **Atomic Updates** | Cập nhật stock không bị race condition | `Product.findByIdAndUpdate(id, { $inc: { stock: -quantity } })` |
| **Async Logging** | Log activity không block main flow | `Activity.log(data).catch(console.error)` |

**Code mẫu - TTL Index:**
```javascript
// backend/src/models/Activity.js
// Tự động xóa activities sau 90 ngày
activitySchema.index(
  { createdAt: 1 }, 
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);
```

**Code mẫu - Atomic Stock Update:**
```javascript
// backend/src/controllers/orderController.js
for (const item of order.items) {
  await Product.findByIdAndUpdate(item.productId, {
    $inc: { stock: -item.quantity }  // Atomic decrement
  });
}
```

---

## 🧪 Demo Failover

### Test 1: Dừng một Shard

```powershell
# 1. Kiểm tra trạng thái ban đầu
docker exec mongos mongosh --eval "sh.status()"

# 2. Dừng Shard 1 (Hà Nội) - Giả lập server sập
docker stop shard1

# 3. Truy cập web http://localhost:5173
#    → Hệ thống vẫn hoạt động với data từ Đà Nẵng và TP.HCM
#    → Chỉ data Hà Nội tạm thời không truy cập được

# 4. Khôi phục Shard 1
docker start shard1

# 5. Kiểm tra shard đã rejoined
docker exec mongos mongosh --eval "sh.status()"
```

### Test 2: Kiểm tra Data Distribution

```powershell
# Đếm documents trên từng shard
docker exec shard1 mongosh --eval "db.getSiblingDB('retail_db').products.countDocuments()"
docker exec shard2 mongosh --eval "db.getSiblingDB('retail_db').products.countDocuments()"
docker exec shard3 mongosh --eval "db.getSiblingDB('retail_db').products.countDocuments()"
```

**Kết quả mong đợi:** Mỗi shard có ~90 products

---

## 👤 Tài Khoản Demo

### Admin (Truy cập tất cả chi nhánh)

| Username | Password | Chi nhánh |
|----------|----------|-----------|
| admin_hanoi | 123456 | Hà Nội |
| admin_danang | 123456 | Đà Nẵng |
| admin_hcm | 123456 | TP.HCM |

### Staff (Chỉ truy cập chi nhánh của mình)

| Username | Password | Chi nhánh |
|----------|----------|-----------|
| staff_hanoi_1 | 123456 | Hà Nội |
| staff_danang_1 | 123456 | Đà Nẵng |
| staff_hcm_1 | 123456 | TP.HCM |

---

## 📡 API Endpoints

### Authentication
```
POST /api/auth/login        # Đăng nhập
POST /api/auth/register     # Đăng ký
GET  /api/auth/me           # Thông tin user hiện tại
POST /api/auth/logout       # Đăng xuất
```

### Products
```
GET    /api/products        # Danh sách sản phẩm (có pagination, filter)
GET    /api/products/:id    # Chi tiết sản phẩm
POST   /api/products        # Tạo sản phẩm mới
PUT    /api/products/:id    # Cập nhật sản phẩm
DELETE /api/products/:id    # Xóa sản phẩm (soft delete)
```

### Orders
```
GET    /api/orders          # Danh sách đơn hàng
GET    /api/orders/:id      # Chi tiết đơn hàng
POST   /api/orders          # Tạo đơn hàng mới
PUT    /api/orders/:id/status  # Cập nhật trạng thái
```

### Statistics
```
GET /api/stats/revenue         # Doanh thu theo ngày/tuần/tháng
GET /api/stats/top-products    # Top sản phẩm bán chạy
GET /api/stats/by-branch       # Thống kê theo chi nhánh
GET /api/stats/by-category     # Thống kê theo danh mục
GET /api/stats/dashboard       # Tổng quan dashboard
```

### Users
```
GET    /api/users           # Danh sách users (admin only)
POST   /api/users           # Tạo user mới
PUT    /api/users/:id       # Cập nhật user
DELETE /api/users/:id       # Xóa user (soft delete)
```

---

## 🔧 Xử Lý Sự Cố

### Lỗi: Docker không chạy
```powershell
# Kiểm tra Docker Desktop đã mở chưa
# Mở Docker Desktop và chờ đến khi hiện "Docker Desktop is running"
docker --version
```

### Lỗi: Containers không khởi động
```powershell
# Xóa containers cũ và chạy lại
cd D:\Projects\retail-distributed-db\docker
docker compose down -v
docker compose up -d
```

### Lỗi: MongoDB connection failed
```powershell
# Kiểm tra mongos đang chạy
docker ps | findstr mongos

# Kiểm tra logs
docker logs mongos
```

### Lỗi: npm run seed thất bại
```powershell
# Kiểm tra MongoDB cluster đã sẵn sàng
docker exec mongos mongosh --eval "sh.status()"

# Chạy lại seed
cd backend
npm run seed
```

### Lỗi: Port đã được sử dụng
```powershell
# Tìm process đang dùng port 5000
netstat -ano | findstr :5000

# Kill process (thay PID bằng số từ lệnh trên)
taskkill /PID <PID> /F
```

---

## 📁 Cấu Trúc Project

```
retail-distributed-db/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # Kết nối MongoDB
│   │   ├── controllers/
│   │   │   ├── authController.js    # Xử lý đăng nhập/đăng ký
│   │   │   ├── productController.js # CRUD sản phẩm
│   │   │   ├── orderController.js   # CRUD đơn hàng
│   │   │   ├── statsController.js   # Thống kê, báo cáo
│   │   │   └── userController.js    # Quản lý users
│   │   ├── models/
│   │   │   ├── User.js              # Schema người dùng
│   │   │   ├── Product.js           # Schema sản phẩm
│   │   │   ├── Order.js             # Schema đơn hàng
│   │   │   └── Activity.js          # Schema lịch sử
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT authentication
│   │   │   └── errorHandler.js      # Xử lý lỗi
│   │   ├── routes/                  # API routes
│   │   └── app.js                   # Entry point
│   ├── scripts/
│   │   └── seedData.js              # Tạo dữ liệu mẫu
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/Layout/       # Header, Sidebar
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx        # Trang chủ + biểu đồ
│   │   │   ├── Products.jsx         # Quản lý sản phẩm
│   │   │   ├── Orders.jsx           # Quản lý đơn hàng
│   │   │   ├── CreateOrder.jsx      # Tạo đơn hàng mới
│   │   │   ├── Users.jsx            # Quản lý users
│   │   │   └── Login.jsx            # Đăng nhập
│   │   ├── services/api.js          # Axios API calls
│   │   ├── context/AuthContext.jsx  # Auth state management
│   │   └── App.jsx                  # Router setup
│   ├── package.json
│   └── vite.config.js
├── docker/
│   ├── docker-compose.yml           # MongoDB Sharded Cluster
│   └── init-cluster.ps1             # Script khởi tạo (PowerShell)
└── README.md                        # File này
```

---

## 🛑 Dừng Hệ Thống

```powershell
# Dừng Frontend (Ctrl+C trong terminal frontend)

# Dừng Backend (Ctrl+C trong terminal backend)

# Dừng MongoDB Cluster
cd D:\Projects\retail-distributed-db\docker
docker compose down

# Xóa toàn bộ data (nếu muốn reset)
docker compose down -v
```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, hãy kiểm tra:
1. Docker Desktop đang chạy
2. Tất cả 5 containers đang running (`docker ps`)
3. Cluster đã được init (`sh.status()` có 3 shards)
4. Backend đang chạy ở port 5000
5. Frontend đang chạy ở port 5173

---

**© 2024 - Bài tập môn Cơ sở dữ liệu phân tán**
