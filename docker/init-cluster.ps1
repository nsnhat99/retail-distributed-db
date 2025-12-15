# init-cluster.ps1
# Script khởi tạo MongoDB Sharded Cluster trên Windows
# Chạy sau khi docker compose up -d

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  MongoDB Sharded Cluster Initialization" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`n[1/6] Chờ các containers khởi động..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Khởi tạo Config Server Replica Set
Write-Host "`n[2/6] Khởi tạo Config Server..." -ForegroundColor Yellow
docker exec configsvr mongosh --eval "rs.initiate({_id:'configRS',configsvr:true,members:[{_id:0,host:'configsvr:27017'}]})"
Start-Sleep -Seconds 5

# Khởi tạo Shard 1 (Hà Nội)
Write-Host "`n[3/6] Khởi tạo Shard 1 (Hà Nội)..." -ForegroundColor Yellow
docker exec shard1 mongosh --eval "rs.initiate({_id:'shard1RS',members:[{_id:0,host:'shard1:27017'}]})"
Start-Sleep -Seconds 3

# Khởi tạo Shard 2 (Đà Nẵng)
Write-Host "`n[4/6] Khởi tạo Shard 2 (Đà Nẵng)..." -ForegroundColor Yellow
docker exec shard2 mongosh --eval "rs.initiate({_id:'shard2RS',members:[{_id:0,host:'shard2:27017'}]})"
Start-Sleep -Seconds 3

# Khởi tạo Shard 3 (HCM)
Write-Host "`n[5/6] Khởi tạo Shard 3 (TP.HCM)..." -ForegroundColor Yellow
docker exec shard3 mongosh --eval "rs.initiate({_id:'shard3RS',members:[{_id:0,host:'shard3:27017'}]})"
Start-Sleep -Seconds 5

# Thêm Shards vào Cluster qua Mongos
Write-Host "`n[6/6] Thêm Shards vào Cluster..." -ForegroundColor Yellow
docker exec mongos mongosh --eval "sh.addShard('shard1RS/shard1:27017')"
docker exec mongos mongosh --eval "sh.addShard('shard2RS/shard2:27017')"
docker exec mongos mongosh --eval "sh.addShard('shard3RS/shard3:27017')"
Start-Sleep -Seconds 3

# Enable Sharding cho database và collections
Write-Host "`n[7/7] Cấu hình Sharding cho database..." -ForegroundColor Yellow
docker exec mongos mongosh --eval @"
// Enable sharding cho database
sh.enableSharding('retail_db')

// Shard collection products theo branch
sh.shardCollection('retail_db.products', { branch: 1, _id: 1 })

// Shard collection orders theo branch  
sh.shardCollection('retail_db.orders', { branch: 1, _id: 1 })

// Shard collection activities theo branch
sh.shardCollection('retail_db.activities', { branch: 1, _id: 1 })

print('✅ Sharding configured successfully!')
"@

# Kiểm tra trạng thái
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Kiểm tra trạng thái Cluster" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
docker exec mongos mongosh --eval "sh.status()"

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  ✅ CLUSTER ĐÃ SẴN SÀNG!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Mongos Router: mongodb://localhost:27017" -ForegroundColor White
Write-Host "  Config Server: localhost:27100" -ForegroundColor White
Write-Host "  Shard 1 (HN):  localhost:27101" -ForegroundColor White
Write-Host "  Shard 2 (DN):  localhost:27102" -ForegroundColor White
Write-Host "  Shard 3 (HCM): localhost:27103" -ForegroundColor White
Write-Host "============================================`n" -ForegroundColor Green
