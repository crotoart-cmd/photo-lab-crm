import { Link } from 'react-router-dom';

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
    <div className="ps-page">
      <section className="ps-stage">
        <div className="ps-stage-inner">
          <h1>Vẫn chụp film. Vẫn gửi lab.</h1>
          <Link to="/film" className="ps-cta ps-cta--on-dark">
            Tráng film →
          </Link>
        </div>
      </section>

      <div className="ps-tiles">
        <Link to="/film" className="ps-tile ps-tile--film">
          <div className="ps-tile-top">
            <h2>Tráng film</h2>
            <span className="ps-tile-go" aria-hidden>
              ›
            </span>
          </div>
          <p>Màu, đen trắng, slide. Scan xong gửi link ảnh trên email.</p>
        </Link>
        <Link to="/sua-may" className="ps-tile ps-tile--repair">
          <div className="ps-tile-top">
            <h2>Sửa máy</h2>
            <span className="ps-tile-go" aria-hidden>
              ›
            </span>
          </div>
          <p>Kiểm tra, báo giá, bạn xác nhận — rồi lab mới sửa.</p>
        </Link>
      </div>

      <div className="ps-body">
        <section className="ps-section" id="faq">
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
