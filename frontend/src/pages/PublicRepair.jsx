import { Link } from 'react-router-dom';

const STEPS = [
  { n: '01', t: 'Mang máy, lab tiếp nhận' },
  { n: '02', t: 'Báo giá — bạn xác nhận trên email' },
  { n: '03', t: 'Sửa xong, trả máy' },
];

const FAQS = [
  {
    q: 'Có sửa luôn khi gửi máy không?',
    a: 'Không. Sau khi kiểm tra, lab gửi báo giá. Bạn bấm xác nhận trên link email thì mới bắt đầu sửa.',
  },
  {
    q: 'Máy nào nhận?',
    a: 'Ưu tiên máy film analog (compact, rangefinder, SLR). Máy khác lab xem từng trường hợp khi tiếp nhận.',
  },
  {
    q: 'Từ chối báo giá thì sao?',
    a: 'Bạn từ chối trên cùng link. Lab không sửa; máy trả theo trạng thái trên phiếu.',
  },
  {
    q: 'Link xác nhận hết hạn?',
    a: 'Liên hệ lab bằng thông tin trên phiếu. Đừng dùng tài khoản quản trị — đó là cửa hàng, không phải trang khách.',
  },
];

export default function PublicRepair() {
  return (
    <>
      <section className="ps-hero">
        <p className="ps-kicker">Dịch vụ</p>
        <h1>Sửa máy</h1>
        <p className="ps-lede">
          Kiểm tra, báo giá, bạn đồng ý rồi mới làm. Cùng luồng phiếu sửa máy trong lab — khách chỉ thấy phần của mình.
        </p>
        <div className="ps-cta-row">
          <Link to="/film" className="apple-btn-secondary">
            Tráng film
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
        <h2>Báo giá trên email</h2>
        <p>
          Khi phiếu ở trạng thái chờ xác nhận, bạn nhận link riêng. Link đó chỉ xem báo giá, đồng ý hoặc từ chối — không
          mở được kho hay đơn hàng của lab.
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
