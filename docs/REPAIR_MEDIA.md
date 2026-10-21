# Ảnh và video trong yêu cầu sửa máy

## Phạm vi

Khách gửi file ở form sửa máy, trong phần số sê-ri và tình trạng bên ngoài. File theo suốt ba bước, có thể xem/bỏ trước khi gửi. Khi có file, khách xác nhận nội dung mô tả chiếc máy gửi và lab sẽ kiểm tra lại khi nhận máy.

Admin xem tư liệu trong chi tiết phiếu sửa, tải bản gốc và xem tên file, dung lượng, loại, thời điểm hệ thống nhận cùng SHA-256. Nội dung khách khai ban đầu được lưu riêng với các trường vận hành của lab. Email tiếp nhận có manifest tên file/thời điểm/hash, không đính kèm binary hoặc link công khai.

Phiếu cũ và yêu cầu JSON không có file vẫn hoạt động. Không đưa binary vào localStorage hoặc hàng chờ native offline; xem file cần kết nối backend và phiên đăng nhập hợp lệ.

## Giới hạn

- Tối đa 6 file, bao gồm tối đa 2 video.
- Mỗi ảnh tối đa 10 MiB, video tối đa 50 MiB, tổng tối đa 100 MiB.
- JPG/JPEG, PNG, WebP, HEIC/HEIF; MP4, MOV, WebM.
- Server kiểm tra allowlist extension/MIME và chữ ký nội dung, không tin chỉ tên file do trình duyệt gửi.
- Kiểm tra tổng dung lượng trong lúc stream xuống disk, không đợi đọc hết vào RAM.
- Tối đa 2 multipart upload đồng thời trên mỗi tiến trình; 8 yêu cầu sửa mỗi IP/giờ theo cơ chế rate limit hiện có. Cần cấu hình proxy IP chính xác, không tin mọi X-Forwarded-For.
- Kho mặc định có hạn mức 2 GiB và cần khoảng trống disk dự phòng; đầy kho trả lỗi thay vì nhận phiếu thiếu đính kèm.

Định dạng file không đồng nghĩa codec được mọi trình duyệt hỗ trợ. HEIC hoặc MOV/HEVC có thể không xem được trực tiếp trên một số máy; vẫn tải được nguyên bản để mở bằng ứng dụng phù hợp. Không có bước nén, resize, chuyển codec hoặc chỉnh metadata file gốc.

## Cấu hình vận hành

`REPAIR_MEDIA_DIR` là đường dẫn tuyệt đối đến storage riêng tư bền vững. Mặc định phát triển là `backend/private/repair-media`; thư mục này bị Git ignore và không được phục vụ bằng Express static.

Production phải trỏ biến này đến volume/storage tồn tại qua redeploy; không dùng thư mục release tạm. Backup thư mục này cùng MongoDB tại mốc nhất quán và kiểm thử restore cả hai. Bản backup JSON của mobile không chứa binary evidence.

`REPAIR_MEDIA_STORAGE_LIMIT_MB` đặt hạn mức kho bằng MiB, mặc định `2048`. Đây là bảo vệ theo tiến trình và kiểm tra filesystem; nhiều instance cần quota/admission thống nhất ở tầng hosting/storage. Không tăng hạn mức nếu chưa có dung lượng và chính sách backup phù hợp.

Reverse proxy/hosting cần cho request multipart khoảng 101 MiB, timeout upload tới 180 giây và hỗ trợ byte ranges khi tải video. Không nới giới hạn JSON toàn hệ thống để nhận video. Kiểm tra giới hạn thực tế trên Hostinger trước khi phát hành; nếu proxy không cho phép thì giảm giới hạn đồng bộ client/server hoặc dùng giải pháp object storage riêng được xác thực.

API file là `GET /api/repairs/:ticketId/media/:mediaId`, tải bản gốc thêm `?download=1`. Cả hai kiểm tra phiên server và role owner/admin/staff, tra file theo đúng phiếu rồi mới phục vụ. Không có public media URL, không lấy đường dẫn do client cung cấp. Response `private, no-store`, `nosniff`; route hỗ trợ byte ranges qua `sendFile`.

## Tính toàn vẹn và giới hạn bằng chứng

- Thời gian `uploaded_at` do server ghi lúc nhận, không phải thời điểm chụp; không coi EXIF hoặc tên file là bằng chứng đáng tin về thời điểm/tác giả.
- SHA-256 mô tả chính xác bytes đã nhận, giúp đối chiếu file. Không chứng minh ảnh/video chân thực, chưa bị chỉnh sửa trước khi gửi, hoặc thuộc đúng chiếc máy nếu chưa kiểm tra vật lý.
- `source=customer` chỉ nói file được gửi từ form công khai, không phải danh tính khách đã được xác minh. Tính năng không bổ sung xác thực OTP hoặc kiểm chứng danh tính.
- Các trường `intake_media`, `customer_submission`, thời điểm và phiên bản xác nhận được đặt immutable ở model; không có API sửa/xóa/thay file gốc. Đây không phải storage WORM, chữ ký số hoặc nhật ký chống sửa bởi người có quyền trực tiếp DB/filesystem.
- Không quảng bá tính năng như điều khoản miễn trách nhiệm hoặc bảo đảm thắng tranh chấp. Lab vẫn nên chụp/quay lúc thực tế nhận máy, đối chiếu serial/phụ kiện và ghi nhận tình trạng hai bên xác nhận. Tải tư liệu của nhân viên ở từng giai đoạn là phạm vi tiếp theo, chưa được triển khai trong thay đổi này.
- Không tự xóa evidence theo lịch dọn cache. Chính sách lưu/xóa dữ liệu cá nhân cần được chủ hệ thống chốt và công bố phù hợp; cân đối dung lượng kho theo thời gian lưu.
- Hiện có signature/MIME/size validation, không tích hợp antivirus hoặc kiểm tra toàn bộ codec. Nếu môi trường yêu cầu, bổ sung scanner cách ly trước khi cho admin xem, bảo toàn bản gốc và trạng thái quét rõ ràng.

## Xác nhận khách hàng

Phiên bản `repair-media-v1`, nội dung tiếng Việt:

> Tôi xác nhận ảnh / video đính kèm mô tả đúng chiếc máy tôi gửi. Lab sẽ kiểm tra tình trạng thực tế khi nhận máy.

Có bản dịch Anh/Đức/Tây Ban Nha trong frontend. Server ghi `media_acknowledged_at` và `media_acknowledgment_version` khi yêu cầu có file được lưu. Nội dung không phải một điều khoản từ bỏ quyền khiếu nại.

## Xử lý lỗi

- Lỗi định dạng, hạn mức hoặc thiếu xác nhận: từ chối và dọn batch chưa được gắn phiếu.
- Khách hủy upload trước khi lưu: dọn file tạm khi parser kết thúc/abort. Form giữ thông tin/file trong bộ nhớ để thử lại; reload hoặc đóng trang không được coi là bản backup.
- Phiếu đã được DB lưu: giữ file kể cả gửi email lỗi hoặc client mất kết nối, không xóa vì HTTP sau đó thất bại.
- DB lỗi không rõ đã ghi hay chưa: giữ batch riêng tư để đối soát; có thể tạo orphan. Không chạy xóa orphan tự động nếu chưa chứng minh không còn phiếu tham chiếu.
- Dừng tiến trình giữa upload có thể để lại batch dở; công cụ dọn cần kiểm tra tuổi file, log và tham chiếu DB. Không có cơ chế tự dọn theo tuổi trong thay đổi này để tránh xóa bằng chứng nhầm.
- Timeout/hủy chờ sau khi server đã lưu có thể vẫn có phiếu. Kiểm tra email/admin trước khi gửi lại; endpoint hiện chưa có khóa idempotency để chống mọi trường hợp tạo phiếu lặp sau mất kết nối.

Hướng bảo vệ upload tham chiếu [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): allowlist, kiểm tra nhiều lớp, tên lưu do server sinh, giới hạn dung lượng và lưu ngoài webroot. Các giới hạn chưa triển khai như antivirus và xác minh người gửi được nêu riêng ở trên.
