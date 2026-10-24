# HDTLABX: Báo cáo vá thư viện P0

Ngày: 24/10/2026. Bản nền: `ff222453223b902d6b510864b30b1a57c0aa1678`.
Phạm vi bản vá này: thư viện runtime và kiểm thử hồi quy; không đổi giao diện,
không thay MongoDB URI, JWT, MFA key, SMTP, mật khẩu hoặc dữ liệu hiện tại.

## Kết quả

| Thư viện | Trước | Sau | Cảnh báo |
| --- | --- | --- | --- |
| body-parser, dependency của Express | 1.20.8 | 1.20.9 | High, GHSA-27r3-jxmh-p828 |
| multer | 2.4.0 | 2.5.0 | High, GHSA-q7qp-rjg7-q26m |
| nodemailer | 10.1.0 | 10.1.4 | Moderate, ba advisory về đọc sai địa chỉ nhận |

Audit production dependency trước vá: 2 High, 1 Moderate, tổng 3 package.
Audit sau vá: 0. Không dùng `npm audit fix --force`, không chuyển Express lên major mới.
Chỉ ba package đã đổi phiên bản trong lockfile; Multer và Nodemailer được chốt phiên bản.
Thêm `npm run audit:runtime` để dễ chạy lại kiểm tra này.

## Bằng chứng kiểm thử

Trước nâng thư viện, 5 trong 7 kiểm thử mới thất bại trên bản cũ:

- Request gzip có phần đuôi bất thường làm tiến trình thử kết thúc bởi lỗi Gunzip không được xử lý.
- Callback upload chậm sau khi parser đã kết thúc làm tiến trình thử kết thúc bởi lỗi multipart.
- Ba trường hợp địa chỉ email đặc biệt bị đọc sang địa chỉ ở domain khác.

Sau nâng thư viện: 7/7 kiểm thử mới qua, tổng backend 104/104 qua.
Các ca parser chạy trong tiến trình con có timeout, chỉ bind `127.0.0.1` và không chạm server thật.
Email dùng `streamTransport`, chỉ tạo message/envelope trong bộ nhớ, không kết nối SMTP hay gửi thư.
Kiểm thử email kiểm tra chính xác kết quả parser và domain nhận sau bước dựng SMTP envelope;
không giả định bộ dựng SMTP giữ nguyên từng ký tự của local part có dấu ngoặc kép.
Các kiểm thử upload hợp lệ, giới hạn file, dọn file lỗi, phân quyền và MFA hiện có vẫn qua.

Frontend không có file nguồn hoặc stylesheet nào thay đổi trong bản vá này.
Suite frontend vẫn có một lỗi CTA Scan/Print/Speed từ trước, không liên quan đợt P0.
Kết quả audit sạch chỉ nói về các advisory đã biết của thư viện runtime tại thời điểm kiểm tra.

## Các đợt tiếp theo, chưa tính là hoàn thành

1. Phiên admin web: chốt thời gian không hoạt động/tối đa mỗi phiên, lưu phiên server-side,
   hỗ trợ thu hồi từng phiên. Kiểm thử đồng thời với 2FA, đổi mật khẩu, logout và native sync.
   Phiên cũ cần được chuyển đổi có kiểm soát; không thay JWT/MFA key để ép đăng xuất.
2. CSRF toàn bộ API thay đổi dữ liệu dùng cookie: lập danh sách route admin/public/native,
   bổ sung token và kiểm tra nguồn, cập nhật API client cùng lúc. Không dựa riêng vào CORS.
3. Nhật ký: sự kiện đăng nhập/khóa/tắt hoặc bật MFA/đổi thông tin; chỉ lưu metadata tối thiểu,
   có thời hạn giữ và owner-only. Không log mật khẩu, token, QR, OTP, mã dự phòng hoặc nội dung request.
4. Sao lưu: chọn nơi lưu riêng được phê duyệt; MongoDB, media và key phải có quy trình phục hồi
   đồng bộ nhưng lưu key tách biệt. Mã hóa, giới hạn truy cập, kiểm tra dung lượng và diễn tập trên DB thử.

Chưa xuất dữ liệu khách hàng, chưa lưu khóa vào chỗ mới, chưa khôi phục hoặc xóa DB thật.
Trước khi chạy backup thật cần xác nhận nơi nhận dữ liệu và quyền truy cập kho sao lưu.
Không tự sửa các mục P1 trong đợt vá thư viện để tránh trộn thay đổi xác thực với nâng dependency.

## Nguồn chính thức

- [body-parser advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
- [Multer advisory](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m)
- [Nodemailer: nested comment](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-8c8m-p3m8-cjg8)
- [Nodemailer: group separator](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-m943-m63m-w62w)
- [Nodemailer: angle address](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-85x2-q946-cp5h)
