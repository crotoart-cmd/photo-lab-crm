# HDTLABX: Google Authenticator và kế hoạch bảo mật admin

Ngày cập nhật: 24/10/2026. Phạm vi: tài khoản owner tại `admin.hdtlabx.com`.
Không thêm staff, không đăng nhập Google/Microsoft, không thay logo hoặc UI website khách hàng.

## 1. Bước Google Authenticator

Đã tích hợp TOTP chuẩn: 6 số, chu kỳ 30 giây, chấp nhận lệch tối đa một chu kỳ.
Mật khẩu đúng chỉ tạo yêu cầu xác thực ngắn hạn, không cấp phiên đầy đủ khi tài khoản đã bật 2FA.
Yêu cầu hết hạn sau 5 phút, tối đa 5 lần thử. Giới hạn theo tài khoản: 10 lần trong 15 phút,
lưu trong MongoDB để không bị đặt lại khi tạo yêu cầu khác hoặc khởi động lại server.
Mã TOTP đã dùng và mã dự phòng được tiêu thụ bằng cập nhật có điều kiện, chống dùng lại đồng thời.

Khóa TOTP lưu dưới dạng AES-256-GCM, ràng buộc với ID tài khoản; khóa mã hóa riêng nằm trong
`MFA_ENCRYPTION_KEY` trên Hostinger, không tái sử dụng JWT secret. QR tạo ngay trong backend,
không gửi khóa sang Google hay dịch vụ tạo QR bên ngoài. Không ghi khóa/mã vào log.
Các thao tác thiết lập có CSRF token gắn với phiên và kiểm tra Origin cho phiên cookie.

Mỗi lần bật/tạo lại cung cấp 10 mã dự phòng ngẫu nhiên, mỗi mã dùng một lần. Database chỉ giữ hash.
Bật/tắt 2FA, tạo lại mã dự phòng, đổi mật khẩu/email khi đã bật 2FA đều thu hồi phiên cũ.
Đổi thông tin đăng nhập, tắt 2FA và tạo lại mã dự phòng yêu cầu mật khẩu hiện tại và yếu tố thứ hai.
Không thể dùng màn hình sửa staff để sửa tài khoản owner nhằm bỏ qua kiểm tra này.

**Chủ tài khoản phải tự kích hoạt 2FA; triển khai code không tự liên kết điện thoại:**

1. Mở `https://admin.hdtlabx.com/profile`, đăng nhập bằng mật khẩu hiện tại.
2. Tại Google Authenticator, chọn bật và tự nhập lại mật khẩu.
3. Trong ứng dụng Google Authenticator trên điện thoại, thêm tài khoản bằng QR hoặc khóa nhập tay.
4. Nhập mã 6 số đang hiển thị để xác nhận. Chỉ lúc này hệ thống mới bật bắt buộc 2FA.
5. Tải/lưu mã dự phòng ở nơi riêng an toàn, xác nhận đã lưu, rồi hoàn tất.
6. Kiểm tra đăng nhập ở cửa sổ khác. Không gửi QR, khóa, mã OTP hoặc mã dự phòng qua chat.

Nếu vừa dùng một mã TOTP, đợi điện thoại chuyển sang mã mới trước thao tác bảo mật kế tiếp.
Hủy trước xác nhận không bật 2FA; QR chờ tự hết hạn sau 10 phút.

## 2. Khôi phục và vận hành

- Mất điện thoại: đăng nhập bằng mật khẩu và một mã dự phòng; mỗi mã chỉ sử dụng một lần.
- Chuyển điện thoại: khi còn quyền truy cập, chuyển tài khoản bằng chức năng của Authenticator,
  hoặc tắt rồi thiết lập lại 2FA bằng các bước có xác thực. Không chia sẻ khóa cho kỹ thuật viên.
- Mất cả điện thoại lẫn mã dự phòng: không có đường bỏ qua 2FA bằng mật khẩu đơn thuần.
  Cần quy trình xác minh chủ sở hữu ngoài hệ thống, sao lưu dữ liệu trước và phục hồi có ghi nhận,
  có phê duyệt riêng. Bản này không tạo endpoint khôi phục không cần yếu tố thứ hai.
- Sao lưu `MFA_ENCRYPTION_KEY` bằng kho bí mật được bảo vệ, tách biệt với bản sao database.
  Không tự đổi/xóa key khi triển khai: dữ liệu TOTP cũ cần đúng key để giải mã.
- Khôi phục ứng dụng phải khôi phục cả dữ liệu MFA, sessionVersion và key tương ứng.
  Không rollback về code chưa kiểm tra MFA sau khi owner đã bật: phiên bản cũ có thể bỏ qua 2FA.
- Không thay MongoDB URI, JWT, SMTP, mật khẩu owner, hoặc xóa dữ liệu để triển khai bước này.
- Web admin production không chấp nhận cờ URL/localStorage để chuyển sang đăng nhập offline.
  App native và dữ liệu offline hiện có vẫn cần một đợt đánh giá riêng; không coi 2FA server là
  mã hóa hay bảo vệ đầy đủ dữ liệu đã lưu trên thiết bị.

## 3. Kế hoạch tiếp theo, theo thứ tự

| Ưu tiên | Công việc | Tiêu chí hoàn tất |
| --- | --- | --- |
| P0 | Owner tự hoàn tất bật 2FA và lưu mã dự phòng | Đăng nhập mới luôn cần yếu tố thứ hai; mã dự phòng dùng một lần |
| P0, đã vá | `body-parser` 1.20.9, `multer` 2.5.0, `nodemailer` 10.1.4 | Audit runtime: 0; 104 kiểm thử backend qua; không gửi email thật |
| P1, đã làm | Phiên admin web: 30 phút không thao tác, tối đa 8 giờ, danh sách và thu hồi từng phiên | Có thể thu hồi từng phiên; thiết bị cũ không truy cập tiếp |
| P1, đã làm | CSRF cho toàn bộ API thay đổi dữ liệu bằng cookie, kiểm tra Origin | Yêu cầu từ origin khác bị chặn; luồng hợp lệ vẫn hoạt động |
| P1, đã làm | Chống dò mật khẩu lưu trong MongoDB: 10 lần/tài khoản, 30 lần/IP mỗi 15 phút | Khởi động lại hoặc nhiều worker không đặt lại giới hạn; tránh khóa owner vô hạn |
| P1, đã làm (chưa có cảnh báo) | Nhật ký bảo mật 90 ngày, chỉ owner xem; cảnh báo qua email làm sau | Có sự kiện đăng nhập/2FA/đổi thông tin; không ghi mật khẩu, token, QR hay OTP |
| P1 | Sao lưu và diễn tập khôi phục MongoDB + media + khóa | Khôi phục thử trên môi trường riêng, xác nhận đăng nhập và dữ liệu đúng |
| P2 | Đánh giá native/offline và nơi lưu token/dữ liệu | Phân tách offline với quyền server; không hardcode thông tin SMTP/owner |
| P2 | Cân nhắc lớp truy cập bổ sung cho admin | Chỉ triển khai sau kiểm tra tương thích upload, API, webhook và chống khóa ngoài |

Không cần SSO hay tài khoản staff cho các bước trên. TOTP không chống được mọi hình thức phishing;
passkey/WebAuthn là hướng bổ sung sau khi đã ổn định vận hành và khôi phục.

## 4. Cảnh báo thư viện đã xử lý

Audit trước bản vá ngày 24/10 ghi nhận 2 package high và 1 package moderate.
Đợt P0 nâng đúng ba thư viện trong cùng nhánh tương thích, giữ nguyên Express 4 và toàn bộ UI.
Audit sau vá ghi nhận 0 lỗ hổng runtime. Đây là kết quả kiểm tra thư viện tại thời điểm chạy,
không phải chứng nhận toàn bộ ứng dụng không có lỗ hổng.

- `body-parser`: [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), đã nâng 1.20.8 lên 1.20.9 theo dependency của Express 4.
- `multer`: [GHSA-q7qp-rjg7-q26m](https://github.com/advisories/GHSA-q7qp-rjg7-q26m), đã nâng 2.4.0 lên 2.5.0.
- `nodemailer`: [GHSA-8c8m-p3m8-cjg8](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8),
  [GHSA-m943-m63m-w62w](https://github.com/advisories/GHSA-m943-m63m-w62w),
  [GHSA-85x2-q946-cp5h](https://github.com/advisories/GHSA-85x2-q946-cp5h); đã nâng 10.1.0 lên 10.1.4.

Đợt phiên/CSRF/nhật ký: backend 132/132, frontend 52/52, audit runtime 0. Khi triển khai, phiên web cũ phải đăng nhập lại một lần; app native giữ nguyên.

Chi tiết kiểm thử và các đợt P1: [Báo cáo bản vá P0](SECURITY_PATCH_2026-10-24.md).

## 5. Kiểm chứng

- Backend: 104/104 kiểm thử qua, gồm 19 kiểm thử MFA và 7 kiểm thử thư viện mới.
  MongoDB thử tạm, parser chỉ chạy loopback trong tiến trình con, email chỉ dựng trong bộ nhớ.
- Frontend: 50/51 kiểm thử qua, gồm kiểm thử MFA riêng; một lỗi kỳ vọng CTA Scan/Print/Speed
  có sẵn từ trước, không liên quan MFA và không sửa UI để che lỗi này.
- Production build đã qua; kiểm tra giao diện form và QR ở desktop/mobile bằng bản thử loopback.
- Key đã thêm riêng trên Hostinger; chỉ owner tự quét/xác nhận mới kích hoạt tài khoản thật.

Tham khảo: [OWASP MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html),
[OTPAuth](https://github.com/hectorm/otpauth), [QRCode](https://github.com/soldair/node-qrcode).
