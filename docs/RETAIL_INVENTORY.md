# Bán lẻ — SKU / Serial (tách khỏi tồn kho tiêu hao)

## Ba nhóm hàng

| Nhóm | Bảng | Mã | Trừ kho khi bán |
|------|------|-----|-----------------|
| Film | `Film_Stock` | `sku_code` + `expiry_date` (nhiều lô/SKU) | FIFO — hạn gần nhất trước |
| Pin | `Battery_Stock` | `sku_code` (unique) | Trừ `quantity` |
| Máy ảnh | `Camera_Stock` | `camera_code` + `serial_number` (unique) | `San_Hang` → `Da_Ban` |

## Giá tài chính (mỗi SKU / máy)

| Trường | Ý nghĩa |
|--------|---------|
| `cost` | Giá nhập |
| `price` | Giá bán niêm yết |
| `floor_price` | Giá sàn — không cho `unit_price` thấp hơn khi bán |

Lợi nhuận: `profit = total_amount - total_cost` (film FIFO: cộng `cost` từng lô bị trừ).

## API (`/api/retail`)

- `GET /film-sku` — gộp tồn theo SKU (bán hàng)
- `POST /film-stock` — nhập lô (bắt buộc HSD + cost/price/floor)
- `POST /check-sale` — kiểm tra giá sàn, trừ kho, ghi `Retail_Sale` + profit
- `GET /sales` — `{ sales, totals }` doanh thu / lợi nhuận gần đây

## Nhập kho thông minh (AI)

Tab **Nhập AI & mã** trên trang Bán lẻ:

| API | Mô tả |
|-----|--------|
| `POST /retail/smart-intake/scan` | Quét barcode — kho local → catalog → Google (mô phỏng) |
| `POST /retail/smart-intake/vision` | Ảnh base64 — GPT-4o (nếu có `OPENAI_API_KEY`) hoặc mock |
| `POST /retail/smart-intake/confirm` | Lưu vào Film / Pin / Máy + `cost_history` |

**Auto-grouping:** `brand_group`, `category_cluster` tự gán từ tên sản phẩm.

**Cost history:** mỗi lần nhập lô mới (film) hoặc đổi giá nhập (pin) ghi `{ date, cost }` — FIFO bán dùng `cost` của lô.

## UI

Menu **Bán lẻ (Film/Pin/Máy)** → **Bán Hàng - Scan** (quét + chọn thủ công) / **Nhập Hàng** (AI + thủ công).
