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
    a: 'Ưu tiên máy film analog. Máy khác lab xem từng trường hợp khi tiếp nhận.',
  },
  {
    q: 'Từ chối báo giá thì sao?',
    a: 'Bạn từ chối trên cùng link. Lab không sửa; máy trả theo trạng thái trên phiếu.',
  },
  {
    q: 'Link xác nhận hết hạn?',
    a: 'Liên hệ lab bằng thông tin trên phiếu. Đừng dùng cửa hàng quản trị.',
  },
];

export default function PublicRepair() {
  return (
    <div className="ps-page">
      <section className="ps-page-hero">
        <p className="ps-kicker">Dịch vụ</p>
        <h1>Sửa máy</h1>
        <p className="ps-lede">
          Kiểm tra, báo giá, bạn đồng ý rồi mới làm. Khách chỉ thấy phần của mình trên link phiếu.
        </p>
        <Link to="/film" className="ps-cta ps-cta--on-dark">
          Tráng film
        </Link>
      </section>

      <div className="ps-body">
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
            Khi phiếu chờ xác nhận, bạn nhận link riêng: xem giá, đồng ý hoặc từ chối — không mở kho hay đơn của lab.
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
      </div>
    </div>
  );
}
