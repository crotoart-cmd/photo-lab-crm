import { escapeHtml } from './emailLayout';

const SUPPORT_EMAIL = 'nuocleosaigon@gmail.com';
const FANPAGE_NAME = 'Fanpage HDTLabx';
const FANPAGE_URL = 'https://www.facebook.com/nuocleosaigon';

function section(title, paragraphs, listItems) {
  const paras = (paragraphs || [])
    .map((p) => `<p style="margin:0 0 10px;font-size:13px;color:#444;line-height:1.6;">${p}</p>`)
    .join('');
  const list =
    listItems && listItems.length
      ? `<ul style="margin:0 0 12px;padding-left:18px;font-size:13px;color:#444;line-height:1.6;">
          ${listItems.map((li) => `<li style="margin-bottom:6px;">${li}</li>`).join('')}
        </ul>`
      : '';
  return `
    <div style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111;">${escapeHtml(title)}</h3>
      ${paras}
      ${list}
    </div>`;
}

function labeledBlock(label, bodyHtml) {
  return `<p style="margin:0 0 10px;font-size:13px;color:#444;line-height:1.6;"><strong>${label}</strong> ${bodyHtml}</p>`;
}

function rejectionSection() {
  const intro =
    'Cửa hàng sẽ từ chối bảo hành miễn phí đối với các lỗi do tác động ngoại lực, tác nhân do nước hoặc các tác nhân bên ngoài khác, cụ thể:';
  const userErrorList = `<ul style="margin:6px 0 10px;padding-left:18px;font-size:13px;color:#444;line-height:1.6;">
    <li style="margin-bottom:6px;">Hư hỏng cơ tốc, bánh răng, trục lên film do lắp film lệch làm kẹt cơ, cố tình lên film khi đã hết cuộn gây đứt film/gãy trục, hoặc nhấn nút tua film/mở nắp buồng film sai quy trình.</li>
    <li style="margin-bottom:6px;">Lỗi mạch điện tử phát sinh do dùng sai loại pin, lắp ngược cực pin, để pin cũ chảy nước gây rỉ sét, chập cháy mạch.</li>
  </ul>`;

  return `
    <div style="margin-bottom:18px;">
      <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#111;">3. Trường hợp từ chối bảo hành miễn phí</h3>
      <p style="margin:0 0 10px;font-size:13px;color:#444;line-height:1.6;">${intro}</p>
      ${labeledBlock(
        'Tác động ngoại lực:',
        'Máy bị rơi rớt, va đập, nứt vỡ hoặc có dấu hiệu cấn móp, trầy xước ngoại hình phát sinh sau khi đã bàn giao máy thành công.'
      )}
      ${labeledBlock(
        'Tác nhân do nước và môi trường:',
        'Máy bị vào nước, dính chất lỏng, ẩm mốc, rễ tre do bảo quản sai quy định.'
      )}
      ${labeledBlock(
        'Tác nhân bên ngoài khác:',
        'Cát bụi, côn trùng xâm nhập vào bên trong máy gây kẹt hệ thống cơ học.'
      )}
      <p style="margin:0 0 4px;font-size:13px;color:#444;line-height:1.6;"><strong>Lỗi do người dùng thao tác sai cách:</strong></p>
      ${userErrorList}
      ${labeledBlock(
        'Vi phạm quy định niêm phong:',
        'Khách hàng tự ý cạy mở, sửa chữa hoặc mang đến nơi khác ngoài cửa hàng; tem niêm phong bảo hành trên thân máy bị rách, mờ hoặc có dấu hiệu cạy phá.'
      )}
    </div>`;
}

/** Chính sách bảo hành máy ảnh — đính kèm email phiếu bán hàng (Mac + iPhone). */
export function buildCameraWarrantyPolicyHtml() {
  const support = escapeHtml(SUPPORT_EMAIL);
  const fanpage = `<a href="${escapeHtml(FANPAGE_URL)}" style="color:#111;">${escapeHtml(FANPAGE_NAME)}</a>`;

  return `
    <div style="margin-top:28px;padding-top:22px;border-top:2px solid #111;">
      <h2 style="margin:0 0 6px;font-size:14px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.02em;">
        Chính sách bảo hành máy ảnh
      </h2>
      <p style="margin:0 0 16px;font-size:12px;color:#666;line-height:1.5;">
        Áp dụng cho đơn hàng đính kèm trong email này
      </p>
      ${section('1. Thời hạn và hình thức bảo hành', [], [
        '<strong>Thân máy &amp; ống kính:</strong> Bảo hành sửa chữa miễn phí đối với các lỗi kỹ thuật trong vòng <strong>01 tháng</strong> kể từ ngày nhận hàng.',
        '<strong>Sau thời hạn 01 tháng:</strong> Cửa hàng vẫn nhận kiểm tra và sửa chữa máy, tuy nhiên khách hàng sẽ chịu toàn bộ chi phí sửa chữa, thay thế linh kiện (nếu có).',
        '<strong>Chính sách đổi trả (7 ngày đầu):</strong> 1 đổi 1 trong vòng 07 ngày đầu nếu phát sinh lỗi phần cứng từ nhà sản xuất.',
        '<strong>Quy định đổi máy:</strong> Khách hàng được đổi sang các dòng máy tương ứng (cùng model, cùng giá trị) hoặc đổi lên các dòng máy có giá trị cao hơn (khách hàng bù phần chênh lệch giá).',
      ])}
      ${section(
        '2. Phạm vi bảo hành (được sửa chữa miễn phí trong 01 tháng)',
        [
          'Chính sách bảo hành sửa chữa miễn phí chỉ áp dụng cho các lỗi phát sinh do cơ chế tự nhiên (suy hao, lão hóa linh kiện theo thời gian) bao gồm:',
        ],
        [
          'Lỗi màn trập, kẹt cơ, sai tốc độ màn trập.',
          'Lỗi hệ thống đo sáng (Lightmeter) hoạt động không đúng (không bao gồm lỗi do pin).',
          'Ống kính bị kẹt vòng khẩu, kẹt vòng lấy nét.',
        ]
      )}
      ${rejectionSection()}
      ${section('4. Lưu ý quan trọng', [
        'Khách hàng vui lòng <strong>quay video mở hộp và test máy không film</strong> ngay khi nhận.',
        'Cửa hàng <strong>không chịu trách nhiệm</strong> về chi phí film và tráng quét (dev/scan) của khách hàng.',
        'Đối với các đơn hàng bảo hành từ xa, khách hàng vui lòng <strong>tự thanh toán chi phí vận chuyển 2 chiều</strong> khi gửi máy về cửa hàng.',
        `Khi cần hỗ trợ kỹ thuật hoặc yêu cầu bảo hành, quý khách vui lòng phản hồi trực tiếp qua email này (<a href="mailto:${support}" style="color:#111;">${support}</a>) hoặc nhắn tin qua ${fanpage} kèm theo video tình trạng máy.`,
        'Cảm ơn quý khách đã tin tưởng lựa chọn sản phẩm của chúng tôi!',
      ])}
    </div>`;
}
