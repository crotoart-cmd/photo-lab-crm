# Photo Lab CRM System 📷

Hệ thống quản lý phòng lab tráng film ảnh chuyên nghiệp với các tính năng:
- ✅ Quản lý khách hàng
- ✅ Quy trình tráng film tự động
- ✅ Thông báo email xác nhận
- ✅ Trả ảnh tự động với mã xác nhận (1 click)
- ✅ Dashboard quản lý hôm nay
- ✅ Quản lý tồn kho (thuốc, film, máy ảnh)
- ✅ Báo cáo công việc

## Công Nghệ Sử Dụng
- **Frontend**: React 18, Tailwind CSS, Axios
- **Backend**: Node.js, Express.js, MongoDB
- **Email**: Nodemailer
- **Authentication**: JWT
- **Database**: MongoDB

## Cài Đặt Nhanh

### Với Docker (Dễ nhất)
```bash
docker-compose up -d
```

### Manual Setup

**Backend:**
```bash
cd backend
npm install
cp .env.example .env
# Chỉnh sửa .env với thông tin của bạn
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

## Chức Năng Chi Tiết

### 1. Quản Lý Khách Hàng
- Tạo, sửa, xóa thông tin khách hàng
- Lưu email, số điện thoại, địa chỉ

### 2. Tiếp Nhận & Xử Lý Film
- Tiếp nhận film từ khách hàng
- Tự động gửi email xác nhận với mã xác nhận
- Ghi nhận tiến độ tráng
- Hoàn thành tráng

### 3. Trả Ảnh Tự Động (1 Click)
- Mã xác nhận từ email
- Quản lý xác nhận đơn giản
- Chỉ cần 1 click để trả ảnh

### 4. Dashboard Quản Lý
- Số film tiếp nhận hôm nay
- Số film chưa trả hết (khách chờ)
- Số film sẵn sàng trả
- Tồn kho theo danh mục
- Cảnh báo hàng tồn kho thấp

### 5. Quản Lý Tồn Kho
- Thuốc tráng
- Film (color, B&W, slide)
- Máy ảnh
- Vật tư khác
- Cảnh báo khi tồn kho thấp

## Cấu Trúc Dự Án

```
photo-lab-crm/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── .env.example
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── App.js
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── docker-compose.yml
├── .gitignore
├── README.md
└── INSTALLATION.md
```

## Quy Trình Sử Dụng

### Nhân Viên Tiếp Nhận Film
1. Vào trang "Films"
2. Click "Receive Film"
3. Chọn khách hàng
4. Nhập số lượng & loại film
5. Hệ thống tự động gửi email xác nhận với mã

### Quản Lý Xử Lý Tráng
1. Vào "Films" → "Processing"
2. Click "Start Processing"
3. Thực hiện tráng
4. Click "Complete" khi hoàn thành

### Quản Lý Trả Ảnh
1. Vào "Films" → "Completed"
2. Click "Deliver (1 Click)"
3. Hệ thống tự động xác nhận trả

## Các Endpoint API

### Authentication
- `POST /api/auth/register`
- `POST /api/auth/login`

### Customers
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`

### Films
- `GET /api/films`
- `POST /api/films/receive`
- `PUT /api/films/:id/start-processing`
- `PUT /api/films/:id/complete`
- `PUT /api/films/:id/deliver`

### Inventory
- `GET /api/inventory`
- `POST /api/inventory`
- `PATCH /api/inventory/:id/quantity`

### Dashboard
- `GET /api/dashboard/today`
- `GET /api/dashboard/monthly`

## Cấu Hình Email

### Gmail (Khuyến nghị)
1. Bật xác thực 2 yếu tố
2. Tạo mật khẩu ứng dụng
3. Thêm vào `.env`:
```
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=app_password_here
```

---

**Phát triển bởi**: Copilot AI  
**Phiên bản**: 1.0.0
