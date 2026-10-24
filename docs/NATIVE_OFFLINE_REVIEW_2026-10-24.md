# HDTLABX: Rà soát app native và dữ liệu offline

Ngày: 24/10/2026. Phạm vi: app iPhone/Android (Capacitor), app macOS (Electron) và chế độ offline.
Chỉ đọc mã nguồn, chưa sửa gì. Mức độ dưới đây là đánh giá suy luận từ mã, chưa kiểm thử trên máy thật.

| Mức | Phát hiện | Vị trí | Đề xuất |
| --- | --- | --- | --- |
| Cao | Đăng nhập offline chỉ kiểm tra mật khẩu đã lưu trên máy, bỏ qua 2FA của server | `frontend/src/lib/mobileOfflineAuth.js` | Khi tài khoản bật 2FA: chỉ mở offline sau Face ID/Touch ID hoặc mật mã máy; không cấp quyền server bằng phiên offline |
| Cao | Android cho phép HTTP không mã hóa tới mọi địa chỉ (`cleartextTrafficPermitted="true"`, `allowMixedContent`) | `ios-app/android/.../network_security_config.xml`, `capacitor.config.json` | Chỉ cho HTTP tới IP mạng nội bộ của Mac; mọi kết nối internet bắt buộc HTTPS |
| Trung bình | Token server 7 ngày và hash mật khẩu offline nằm trong `localStorage` của WebView | `frontend/src/api/client.js`, `mobileOfflineAuth.js` | Chuyển sang Keychain (iOS) / Keystore (Android) qua plugin lưu trữ an toàn; tăng PBKDF2 lên 600.000 vòng |
| Trung bình | Phiên native không có trong danh sách phiên; đăng xuất native tăng `sessionVersion` nên đăng xuất luôn mọi phiên web | `backend/routes/auth.js` (logout) | Lưu phiên native phía server như phiên web, thu hồi được từng thiết bị |
| Thấp | Lần đầu không có server, app cho tạo mật khẩu offline bất kỳ (≥ 6 ký tự) | `bootstrapOfflineLogin` | Chỉ cho phép sau khi đã đăng nhập online ít nhất một lần, mật khẩu ≥ 12 ký tự |
| Tốt | Electron bật `contextIsolation`, tắt `nodeIntegration`; iOS chỉ mở HTTP cho mạng nội bộ (`NSAllowsLocalNetworking`) | `macos-app/electron/main.js`, `Info.plist` | Giữ nguyên; cân nhắc bật `sandbox: true` cho cửa sổ Electron |

## Thứ tự đề xuất

1. Khóa offline bằng sinh trắc học khi đã bật 2FA, và siết HTTP trên Android. Hai việc này cần build lại app và thử trên điện thoại thật.
2. Chuyển token và hash sang Keychain/Keystore.
3. Phiên native phía server, có trong mục "Phiên & bảo mật".

Các bước trên đổi cách app đăng nhập, nên cần chủ tài khoản duyệt và thử trên thiết bị trước khi phát hành.
