# Security audit — HDTLabx

> Cập nhật vá mã nguồn 14/10/2026: xem mục "Đợt 3" ở cuối. Các phát hiện lịch sử bên dưới được giữ để đối chiếu; trạng thái hiện tại lấy theo mục cập nhật.

Ngày: 2026-10-14  
Phạm vi: mã nguồn repository hiện tại (Express + React/Vite + MongoDB).  
Không kiểm thử tấn công trên production, không gửi form thật, không in secrets/PII.

**Không kết luận “đã bảo mật”.** Phần Hostinger/CDN/WAF nằm ngoài repo — trạng thái: **cần chủ website áp dụng**.

## Thành phần tồn tại

| Thành phần | Có trong code |
|---|---|
| Website công khai `hdtlabx.com` (`/`, `/film`, `/repair`, `/shop`, `/contact`, …) | Có |
| Form công khai POST `/api/public/film`, `/repair`, `/shop/orders` | Có |
| CRM / admin UI + JWT (`/login`, Bearer token) trên `admin.hdtlabx.com` và localhost | Có |
| Phân quyền owner / staff (`middleware/authz.js`, `config/users.js`) | Có |
| Liên kết xác nhận báo giá `/repair/confirm/:token` → `/api/repair-public/:token` | Có |
| Gallery giao ảnh `/delivery/:token` (hash trong DB; file qua `/api/delivery/:token/file`) | Có |
| MFA | **Không tồn tại** |
| Cookie session CRM web | Có (`hdtlabx_sid` httpOnly). Mobile vẫn Bearer để sync cross-origin. |
| CAPTCHA | **Không** (honeypot `website` trên form web) |

---

## Phát hiện

### A1. Token xác nhận báo giá lưu plaintext + POST trả phiếu nội bộ
- **Mức độ:** Critical  
- **Bằng chứng:** `backend/services/customerRepairService.js` (`confirm_token` random 24 bytes hex lưu DB); `backend/routes/repairPublic.js` POST trả `ticket` từ `mapTicket()` gồm `internal_parts_cost`, `profit_estimate`, email. GET vẫn trả PII khi token hết hạn (`expired: true`).  
- **Tác động:** Ai có (hoặc từng có) link email đọc được chi phí nội bộ; token trong DB nếu lộ backup thì dùng được ngay.  
- **Trạng thái:** xác nhận (đã vá trong repo)  
- **Khắc phục:** SHA-256 hash token, entropy 32 bytes, GET/POST hết hạn/không hợp lệ cùng thông điệp 404, POST không trả DTO nội bộ, thu hồi hash khi xác nhận/hủy.  
- **Kiểm thử:** `node --test` — `confirmToken`, `public quote DTO`; staging với token giả.

### A2. Mật khẩu chủ mặc định và seed dữ liệu mẫu trên production boot
- **Mức độ:** Critical  
- **Bằng chứng:** `backend/config/users.js` `OWNER_PASSWORD \|\| '123456'`; `backend/server.js` gọi `ensureSampleCustomers` / `ensureSampleRepairTickets` mỗi lần khởi động, không phụ thuộc `NODE_ENV`.  
- **Tác động:** Tài khoản chủ yếu; khách/phiếu demo trong DB production.  
- **Trạng thái:** xác nhận (đã vá trong repo — production không seed mẫu, không mặc định `123456`)  
- **Khắc phục:** Đặt `OWNER_PASSWORD` mạnh trên Hostinger; xoay nếu từng dùng mặc định.  
- **Kiểm thử:** Khởi động `NODE_ENV=production` không có password mặc định; không tạo khách mẫu.

### A3. CORS `Access-Control-Allow-Origin: *` toàn cục
- **Mức độ:** High  
- **Bằng chứng:** `backend/server.js` `app.use(cors())`. Trùng với quan sát trên site công khai. JWT không cookie nên không phải CSRF cookie, nhưng trình duyệt bất kỳ origin vẫn gọi API (kể cả form công khai / token trên URL).  
- **Tác động:** Trang độc hại đọc response nếu user/trình duyệt gửi request (token trên URL, form).  
- **Trạng thái:** xác nhận (đã vá allowlist)  
- **Khắc phục:** Allowlist `hdtlabx.com`, `www`, `admin.hdtlabx.com`, localhost, Capacitor.  
- **Kiểm thử:** `isAllowedOrigin('https://evil.example') === false`.

### A4. Thiếu security headers; CSP chỉ `upgrade-insecure-requests`; `X-Powered-By: Express`
- **Mức độ:** High (headers) / Medium (CSP chưa enforce script-src)  
- **Bằng chứng:** Không Helmet; `server.js` không set HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy.  
- **Tác động:** Clickjacking, MIME sniff, referrer leak token trên URL, fingerprint stack.  
- **Trạng thái:** xác nhận (đã vá middleware; CSP Report-Only cho script/style allowlist; CSP enforce: frame-ancestors / object-src / base-uri / upgrade-insecure-requests; HSTS chỉ khi `NODE_ENV=production`, không preload/includeSubDomains)  
- **Kiểm thử:** test headers; staging curl `-I` sau deploy.

### A5. Rate limit form tin `X-Forwarded-For` đầu tiên; không limit login/ticket
- **Mức độ:** High  
- **Bằng chứng:** `backend/utils/webIntake.js` (cũ) `x-forwarded-for`.split[0]; chỉ 8/giờ trên form public. Login và `/api/repair-public` không limit.  
- **Tác động:** Bypass limit; brute-force login; quét token; spam email.  
- **Trạng thái:** xác nhận (đã vá: `trust proxy` 1, `req.ip`, limit login / repair-public / delivery / API)  
- **Kiểm thử:** rateLimit unit test; **DDoS volumetric không giải được bằng Express** — xem mục Hostinger.

### A6. Gallery delivery + `/uploads/delivery` công khai; Drive link trong JSON
- **Mức độ:** High  
- **Bằng chứng:** `routes/deliveryPublic.js` không auth; slug = mã phiếu + 8 hex (~32 bit entropy thêm); `express.static('/uploads')`; JSON có `driveWebViewLink`.  
- **Tác động:** Đoán/leaked slug xem ảnh khách; Drive folder nếu chia sẻ rộng.  
- **Trạng thái:** xác nhận (đã vá một phần: slug mới 16 hex, không trả Drive link, cache no-store, 404 generic, chặn path traversal). **Còn lại:** file vẫn đọc được nếu biết URL — kiến trúc gallery cố ý công khai theo slug.  
- **Kiểm thử:** slug `../` → 404; JSON không có `driveWebViewLink`.

### A7. IDOR nhân viên: JWT bất kỳ đọc/sửa phiếu, xóa khách, seed demo
- **Mức độ:** High  
- **Bằng chứng:** `/api/repairs` chỉ `verifyToken`; `DELETE /api/customers/:id` chỉ JWT; `POST /api/dashboard/seed-demo-retail` chỉ JWT. Hệ thống tối đa 2 user (owner+staff) nên bề mặt nhỏ hơn app nhiều tenant, nhưng staff = toàn quyền CRM. JWT không kiểm tra user còn `active` trước khi vá.  
- **Tác động:** Nhân viên khóa vẫn dùng JWT tới khi hết hạn; xóa khách; nạp demo.  
- **Trạng thái:** xác nhận (đã vá: verifyToken kiểm tra user active; xóa/gộp khách và seed demo = owner; seed demo cấm production trừ cờ)  
- **Kiểm thử:** token user khóa → 401; staff DELETE customer → 403.

### A8. Lộ thông tin qua error / email status / backup đã commit
- **Mức độ:** High (backup trong git) / Medium (error message)  
- **Bằng chứng:** error handler cũ `error: err.message`; `/api/email/status` trả `EMAIL_USER` và độ dài app password; `.gitignore` không có `backend/backups/`; file backup mobile đã được track (chứa email khách — không trích giá trị ở đây).  
- **Tác động:** PII trong git history; SMTP user; stack/DB URI nếu lỗi.  
- **Trạng thái:** xác nhận (đã vá error handler, email status, gitignore). **Còn lại:** file backup vẫn trong lịch sử git — **cần xoay/giả định đã lộ nếu repo từng public; `git rm --cached` khi commit.**  
- **Kiểm thử:** 500 không chứa `error` field.

### A9. Body JSON 12mb; upload delivery 100MB × 40 file
- **Mức độ:** Medium  
- **Bằng chứng:** `express.json({ limit: '12mb' })`; `films.js` multer 100MB/file, 40 files.  
- **Tác động:** DoS bộ nhớ.  
- **Trạng thái:** xác nhận (JSON mặc định 4mb). Upload delivery giữ 100MB vì luồng scan — **rủi ro còn lại**, chỉ JWT staff.  
- **Kiểm thử:** POST > 4mb → 413.

### A10. Login tiết lộ email tồn tại; JWT không `exp` nếu thiếu `JWT_EXPIRE`
- **Mức độ:** Medium  
- **Bằng chứng:** `routes/auth.js` message khác nhau; `jwt.sign({ expiresIn: process.env.JWT_EXPIRE })` nếu env trống thì token không hết hạn.  
- **Trạng thái:** xác nhận (đã vá thông điệp chung + mặc định `7d`)  
- **Kiểm thử:** email lạ và sai mật khẩu cùng message.

### A11. JWT trong localStorage (XSS = lấy session)
- **Mức độ:** Medium  
- **Bằng chứng:** `frontend/src/context/AuthContext.jsx` `localStorage.setItem('token')`. Không cookie HttpOnly.  
- **Tác động:** XSS trên admin origin đánh cắp phiên.  
- **Trạng thái:** xác nhận — **chưa đổi kiến trúc** (sẽ phá mobile/offline). CSP Report-Only + không `dangerouslySetInnerHTML`.  
- **Kiểm thử:** không áp dụng chuyển cookie trong đợt này.

### A12. Honeypot form; validate server đã có nhưng chưa clamp độ dài tên
- **Mức độ:** Low  
- **Bằng chứng:** `webIntake.js` `website`; `validateCustomerInput` bắt email/SĐT nhưng không slice tên/địa chỉ.  
- **Trạng thái:** xác nhận (đã clamp)  
- **Kiểm thử:** validation unit test.

### A13. MongoDB query object (Mongoose) — injection thấp
- **Mức độ:** Low  
- **Bằng chứng:** đa số `findById` / field string. Một số `req.query` đưa vào filter (`email.js` filmId).  
- **Tác động:** NoSQL operator nếu client gửi object (JSON). Express json parser cho phép.  
- **Trạng thái:** nghi vấn cần kiểm chứng trên từng query object. filmId nên là string/ObjectId.  
- **Khắc phục (một phần):** không đổi hết query trong đợt này.  
- **Kiểm thử:** chưa có test injection toàn bộ.

### A14. Open redirect / path traversal / SSRF
- **Mức độ:** Low / Informational  
- **Bằng chứng:** redirect `getAdminSiteUrl() + req.originalUrl` — path tương đối; đã sanitize `//`. `getDeliveryDir` join slug — đã chặn `..`. Vision nhận `image_base64` không fetch URL tùy ý (không SSRF URL).  
- **Trạng thái:** xác nhận rủi ro thấp sau vá redirect/slug.

### A15. CSRF
- **Mức độ:** Informational  
- **Bằng chứng:** API dùng `Authorization: Bearer`, không cookie session. Form công khai không cookie. CORS chặt giảm abuse từ trình duyệt.  
- **Trạng thái:** không áp dụng CSRF token cổ điển.

### A16. Source map production
- **Mức độ:** Informational  
- **Bằng chứng:** `frontend/vite.config.js` không bật `build.sourcemap`. Vite mặc định tắt.  
- **Trạng thái:** không áp dụng trừ khi build bị override trên Hostinger.

### A17. Dependency
- **Mức độ:** Medium  
- **Bằng chứng:** `npm audit` (2026-10-14): Express nâng 4.22.3 (vá proxy-addr/qs). Còn lại: **nodemailer 6.10.1** nhiều advisory (CRLF/header/file access); bản vá chính thức **10.1.0** cần Node.js ≥ 20 (engines repo đang `>=18`). nodemon/braces chỉ dev. Đã bật `disableFileAccess` / `disableUrlAccess` trên transport.  
- **Trạng thái:** xác nhận — **chưa bump nodemailer 10** vì Hostinger Node version chưa kiểm chứng; **cần chủ website xác nhận Node 20+ rồi mới nâng.**  
- **Không thể xác minh từ code:** CVE mới sau ngày audit; phiên bản Node trên Hostinger.

### A18. TLS/HSTS production / Atlas 0.0.0.0
- **Mức độ:** Medium (vận hành)  
- **Bằng chứng:** comment `server.js` gợi ý Atlas allow 0.0.0.0/0. HSTS không nên preload khi chưa kiểm kê subdomain (`admin.` tồn tại).  
- **Trạng thái:** không áp dụng trong repo — **cần chủ website**. Không bật `includeSubDomains` / preload trong code.

---

## Cách khắc phục đã làm trong repo

Xem mục “Thay đổi theo file” ở cuối báo cáo hoàn thành (chat). CSP: `style-src` Report-Only vẫn có `'unsafe-inline'` vì React/Tailwind có thể dùng style attribute; `script-src 'self'` sau khi bỏ `onload=` font trong `frontend/index.html`. Chưa enforce CSP đầy đủ — theo dõi Report-Only rồi siết.

---

## Cấu hình ngoài repo — cần chủ website áp dụng

1. **HTTPS:** bật force HTTPS toàn `hdtlabx.com`, `www.hdtlabx.com`, `admin.hdtlabx.com`. Chỉ sau đó HSTS từ app (`max-age=15552000`) mới an toàn. Không preload.  
2. **WAF / CDN / LiteSpeed (nếu có trên Hostinger):** rate limit `/api/public/*`, `/api/auth/login`, `/api/repair-public/*` theo IP; chặn method lạ; không set CORS `*` ở edge.  
3. **DDoS volumetric** (L3/L4, flood Gbps): cần CDN/DDoS provider — **không giải được bằng Node**.  
4. **Secrets Hostinger env:** `JWT_SECRET` ≥ 32 ký tự ngẫu nhiên; `OWNER_PASSWORD` mạnh (xoay nếu từng là mặc định); không để `OWNER_PASSWORD=123456`. `NODE_ENV=production`.  
5. **MongoDB Atlas:** IP allowlist máy Hostinger, không `0.0.0.0/0` nếu có thể. User DB quyền readWrite một database, không atlasAdmin.  
6. **Git:** bỏ track `backend/backups/*.json`; coi PII trong history là đã lộ nếu repo public — xoay quy trình, không cần đổi JWT chỉ vì file backup trừ khi backup chứa token.  
7. **Không cache HTML/API ticket** trên CDN (bypass `/api/*`, `/repair/confirm/*`, `/delivery/*`).  
8. **Không deploy đợt này** — code chỉ trên máy local cho tới khi chủ site yêu cầu.

---

## Đợt 2 — vá dứt điểm rủi ro còn lại (2026-10-14)

| Rủi ro | Cách xử lý trong repo |
|---|---|
| JWT `localStorage` (XSS lấy phiên) | CRM desktop: cookie `hdtlabx_sid` httpOnly, Secure (prod), SameSite=Lax; JSON login **không** trả token trừ `client: mobile`. `/auth/logout` xóa cookie. XSS không đọc được cookie; vẫn có thể cưỡi phiên trên trình duyệt đã XSS — cần CSP. Mobile Capacitor giữ Bearer (cross-origin). |
| Gallery theo slug | Link `/delivery/:accessToken` (64 hex), hash SHA-256 trong DB. File chỉ qua `/api/delivery/:token/file/:filename`. **Không** còn static `/uploads/delivery`. Tạo/gửi link mới thu hồi link cũ. Link slug cũ **hết hiệu lực**. |
| Staff = gần như owner | Staff không: xóa/gộp khách, xóa kho, blog, analytics tài chính, email logs/SMTP, chi phí/lợi nhuận phiếu sửa, nhập linh kiện/công. Staff vẫn: POS, phiếu film, sửa máy (ops), khách (sửa), merch web, backup máy. |
| Upload 100MB×40 | 40MB/file, 15 file, 200MB/lần, 20 lần/giờ. |
| CSP chưa enforce script-src | Enforce `script-src 'self'` (+ connect-src allowlist). `style-src` còn `'unsafe-inline'` vì React. |
| Token plaintext legacy | Boot `migratePlaintextConfirmTokens`: hash rồi xóa field thô. Lookup **chỉ** theo hash — không còn đọc `confirm_token` plaintext. |

**Còn lại (không giải hết bằng code này):** MFA; XSS cưỡi cookie cùng trình duyệt; Google Drive ACL; Node/nodemailer trên Hostinger; DDoS volumetric.

---

## Hạng mục không thể xác minh từ code

- Cipher TLS, chứng chỉ, redirect HTTP thật trên Hostinger.  
- WAF/CDN đang bật hay không.  
- Giá trị env production (không đọc/in).  
- Quyền file trên server, backup Hostinger.  
- Google Drive folder ACL thật.  
- Lưu lượng spam hiện tại.  
- Lịch sử git đầy đủ ngoài workspace.

## Tiêu chí ASVS (rút gọn)

| ASVS | Kết quả |
|---|---|
| V2 Password / V3 Session | Login generic + rate limit; cookie httpOnly trên web; JWT 7d; chưa MFA |
| V4 Access | Staff ops không thấy chi phí nội bộ/blog/analytics; owner-only xóa khách/kho; gallery + quote token hashed |
| V5 Validation | Server validate form; JSON 4mb |
| V7 Error | Production không trả `err.message` ở handler toàn cục |
| V13 API | CORS allowlist; headers |
| V14 Config | Seed/demo gated; assert JWT_SECRET lúc boot production |

---

## Đợt 3 — vá mã nguồn, giữ phạm vi UI/UX (2026-10-14)

- Desktop: bind loopback, credential ngẫu nhiên riêng mỗi bản cài, file riêng quyền 0600; không đóng gói `.env` hoặc backup khách; bỏ password mặc định trong code.
- Mobile: bỏ credential SMTP khỏi JavaScript và build env; đã build và copy lại assets iOS/Android. **Vẫn cần thu hồi credential SMTP đã lộ tại nhà cung cấp** và cập nhật cấu hình thiết bị/server.
- Upload: allowlist extension/MIME, kiểm tra chữ ký nội dung bằng file-type, chặn HTML/JS/SVG, CSP sandbox/nosniff, xóa file batch lỗi. Không đổi bytes ảnh hợp lệ.
- Blog: validate enum và kiểm tra quyền theo loại nội dung cuối cùng, chặn staff chuyển phụ kiện thành blog.
- Auth: sessionVersion thu hồi JWT khi đổi mật khẩu/logout; cập nhật lại cookie/token hiện tại khi đổi mật khẩu và hash offline mobile. JWT cũ cần đăng nhập lại.
- Production: dừng startup khi cấu hình bảo mật yếu; TRUST_PROXY mặc định false và chỉ nhận địa chỉ/subnet rõ ràng.
- Error: lọc response 500 và trường error nội bộ cho API.
- Dependency runtime: backend/frontend/macOS đều 0 advisory tại lần kiểm tra. Bao gồm build tools: frontend còn 7 (5 High, 2 Moderate), macOS còn 8 Moderate. Giữ Tailwind 3 để không phải thay CSS; chưa tuyên bố các cảnh báo build này đã vá.
- Kiểm chứng: 37/37 test (backend 33, desktop 3, client 1), web/mobile build và staging macOS thành công. Yêu cầu Node 20.19+ hoặc 22.12+.
- Không sửa component/màn hình/CSS trong đợt vá bảo mật; giữ nguyên 5 file UI được thay đổi bởi công việc đồng thời. Không deploy, không cài binary native, không gửi email thật, không sửa `.env` đang dùng.
