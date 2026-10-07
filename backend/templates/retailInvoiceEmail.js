const { BRAND_NAME } = require('../config/brand');
const { buildCameraWarrantyPolicyHtml } = require('./cameraWarrantyPolicy');
const {
  buildEmailLayout,
  buildLineItemsTableHtml,
  buildTotalsHtml,
  buildCalloutHtml,
  escapeHtml,
  formatVND,
} = require('./emailLayout');

function buildRetailInvoiceHtml({
  customerName = 'Quý khách',
  orderCode,
  orderDate,
  paymentMethod = 'Tại quầy / Chuyển khoản',
  customerPhone = '',
  lines = [],
  includeWarranty = false,
}) {
  const items = lines.map((line) => ({
    name: line.name,
    serial: line.serial || '—',
    quantity: line.quantity || 1,
    price: line.price,
  }));

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const dateStr =
    orderDate ||
    new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  const bodyHtml = `
    ${buildLineItemsTableHtml(items, { nameCol: 'Thiết bị / Vật phẩm' })}
    <div style="margin-top:20px;">${buildTotalsHtml({ subtotal, shippingLabel: 'Miễn phí' })}</div>
    ${includeWarranty ? buildCameraWarrantyPolicyHtml() : ''}`;

  const calloutHtml = includeWarranty
    ? buildCalloutHtml(
        'Lưu giữ email này',
        'Email này đồng thời là <strong>phiếu bán hàng</strong> và <strong>chứng từ bảo hành</strong> cho máy ảnh trong đơn. Vui lòng lưu lại để đối chiếu khi cần hỗ trợ.'
      )
    : buildCalloutHtml(
        'Tiếp theo',
        'Vui lòng giữ email này làm phiếu mua hàng. Liên hệ cửa hàng nếu cần đổi trả hoặc hỗ trợ thêm.'
      );

  return buildEmailLayout({
    eyebrow: 'PHIẾU BÁN HÀNG',
    greeting: `Xin chào ${escapeHtml(customerName)},`,
    introHtml: `<p style="margin:0;">${escapeHtml(BRAND_NAME)} xác nhận đơn bán lẻ của bạn. Nội dung phiếu dưới đây trùng với giao dịch tại quầy${
      includeWarranty ? ' — kèm chính sách bảo hành máy ảnh' : ''
    }.</p>`,
    metaLeftHtml: `<strong style="color:#111;">MÃ ĐƠN:</strong> ${escapeHtml(orderCode)}<br/><strong style="color:#111;">Ngày:</strong> ${escapeHtml(dateStr)}<br/><strong style="color:#111;">Thanh toán:</strong> ${escapeHtml(paymentMethod)}`,
    metaRightHtml: `<strong style="color:#111;">KHÁCH HÀNG:</strong><br/>${escapeHtml(customerName)}${customerPhone ? `<br/>${escapeHtml(customerPhone)}` : ''}`,
    bodyHtml,
    calloutHtml,
  });
}

module.exports = { buildRetailInvoiceHtml, formatVND: (n) => formatVND(n) };
