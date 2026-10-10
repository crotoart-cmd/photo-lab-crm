import { Link } from 'react-router-dom';

const STEPS = [
  { n: '01', t: 'Gửi cuộn' },
  { n: '02', t: 'Lab tráng và scan' },
  { n: '03', t: 'Nhận link ảnh' },
];

const FAQS = [
  {
    q: 'Lab tráng loại film nào?',
    a: 'Màu (C-41), đen trắng và slide. Ghi rõ loại khi gửi — đừng mở cuộn nếu chưa chắc.',
  },
  {
    q: 'Máy chụp một lần (disposable) có tráng được không?',
    a: 'Có. Mang cả máy; lab lấy film ra, tráng và scan như cuộn thường.',
  },
  {
    q: 'Mất bao lâu?',
    a: 'Tùy số cuộn và loại. Thời gian cụ thể ghi trên phiếu khi tiếp nhận.',
  },
  {
    q: 'Ảnh gửi thế nào?',
    a: 'Link gallery trên email khi scan xong. Không cần đăng nhập hệ thống quản lý.',
  },
];

export default function PublicFilm() {
  return (
    <>
      <section className="ps-hero">
        <p className="ps-kicker">Dịch vụ</p>
        <h1>Tráng film</h1>
        <p className="ps-lede">
          Gửi cuộn tới lab. Chúng tôi tráng, scan, rồi gửi ảnh — cùng quy trình phiếu lab dùng hàng ngày.
        </p>
        <div className="ps-cta-row">
          <Link to="/sua-may" className="apple-btn-secondary">
            Sửa máy
          </Link>
        </div>
      </section>

      <ol className="ps-steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <b>Bước {s.n}</b>
            <span>{s.t}</span>
          </li>
        ))}
      </ol>

      <section className="ps-section ps-prose">
        <h2>Khi gửi film</h2>
        <p>
          Để nguyên trong hộp hoặc trong máy. Lab ghi format, ISO và yêu cầu scan trên phiếu tiếp nhận. Film gốc trả
          theo thỏa thuận trên phiếu — không tự ý cắt nếu bạn chưa yêu cầu.
        </p>
      </section>

      <section className="ps-section">
        <h2>Câu hỏi</h2>
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
