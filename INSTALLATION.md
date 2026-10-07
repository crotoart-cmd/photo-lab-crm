# Hướng dẫn cài đặt HDTLabx

Site production: https://hdtlabx.com

## Yêu cầu

- Node.js 18+
- MongoDB 6+ (hoặc Docker)
- npm

## 1. Clone & cấu hình

```bash
git clone https://github.com/crotoart-cmd/photo-lab-crm.git
cd photo-lab-crm
```

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Chỉnh MONGODB_URI, JWT_SECRET, EMAIL_* nếu cần gửi mail
npm start
```

Tạo dữ liệu mẫu (tùy chọn):

```bash
node scripts/seed.js
# Đăng nhập: admin@labstart.local / admin123
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Mở http://localhost:3000

> **macOS:** Port 5000 thường bị AirPlay chiếm. Dự án dùng **port 5001** cho API.

### Chạy nhanh (không cần cài Node/MongoDB toàn máy)

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Lần đầu script tự tải Node vào `.tools/node`. Backend dùng MongoDB in-memory (`USE_MEMORY_DB=true`).

## 2. Docker (khuyến nghị)

Từ thư mục gốc dự án:

```bash
# Tùy chọn: tạo file .env ở root với EMAIL_USER, EMAIL_PASSWORD
docker compose up -d --build
```

- Web: http://localhost:3000
- API: http://localhost:5000/api/health

Seed admin (chạy trong container backend):

```bash
docker compose exec backend node scripts/seed.js
```

## 3. Cấu hình Gmail

1. Bật xác thực 2 bước
2. Tạo App Password
3. Thêm vào `backend/.env`:

```
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=app_password
```

Nếu không cấu hình email, hệ thống vẫn chạy — email chỉ được log ra console.

## 4. Quy trình sử dụng nhanh

1. Đăng ký / đăng nhập
2. Thêm khách hàng
3. **Film** → Tiếp nhận film → email mã xác nhận
4. Bắt đầu tráng → Hoàn thành
5. **Trả ảnh (1 click)** — nhập mã từ email khách
