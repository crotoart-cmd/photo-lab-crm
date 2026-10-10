import { Link } from 'react-router-dom';
import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand';

const FAQS = [
  {
    q: 'Mang film chưa mở cuộn được không?',
    a: 'Được. Để nguyên trong hộp hoặc trong máy. Lab tiếp nhận, ghi loại film, rồi tráng và scan.',
  },
  {
    q: 'Sửa máy có làm luôn không?',
    a: 'Không. Lab kiểm tra, gửi báo giá. Bạn xác nhận trên link email rồi mới sửa.',
  },
  {
    q: 'Nhận ảnh bằng cách nào?',
    a: 'Khi scan xong bạn nhận link gallery trên email — không cần tài khoản quản lý.',
  },
];

export default function PublicHome() {
  return (
    <>
      <section className="ps-hero">
        <p className="ps-kicker">Hai dịch vụ</p>
        <h1>{BRAND_NAME}</h1>
        <p className="ps-lede">{BRAND_TAGLINE}. Tráng film và sửa máy analog — quy trình rõ, báo trước khi làm.</p>
        <div className="ps-cta-row">
          <Link to="/film" className="apple-btn-primary">
            Tráng film
          </Link>
          <Link to="/sua-may" className="apple-btn-secondary">
            Sửa máy
          </Link>
        </div>
      </section>

      <div className="ps-grid ps-grid--2">
        <Link to="/film" className="ps-card">
          <h2>Tráng film</h2>
          <p>Màu, đen trắng và slide. Tiếp nhận cuộn, tráng, scan, gửi link ảnh khi xong.</p>
          <span className="ps-card-link">Xem quy trình</span>
        </Link>
        <Link to="/sua-may" className="ps-card">
          <h2>Sửa máy</h2>
          <p>Máy film analog. Kiểm tra, báo giá, bạn xác nhận, lab sửa rồi trả máy.</p>
          <span className="ps-card-link">Xem quy trình</span>
        </Link>
      </div>

      <section className="ps-section">
        <h2>Câu hỏi thường gặp</h2>
        <div className="ps-faq">
          {FAQS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
