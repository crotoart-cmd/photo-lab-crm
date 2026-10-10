import { Link } from 'react-router-dom';

export default function PublicFilm() {
  return (
    <div className="ps-page">
      <section className="ps-page-hero">
        <p className="ps-kicker">Dịch vụ</p>
        <h1>Tráng</h1>
        <p className="ps-lede">
          Film được tráng trên máy bán tự động Jobo ATL-3000 và Jobo CPA-2. Một mẻ tối đa 12 cuộn, xử lý nhẹ để giữ
          chi tiết.
        </p>
        <Link to="/toc-do" className="ps-cta ps-cta--on-dark">
          Xem tốc độ
        </Link>
      </section>

      <div className="ps-body">
        <section className="ps-section ps-prose">
          <h2>B&amp;W và ECN-2</h2>
          <p>
            Đen trắng và ECN-2 chạy trên Jobo ATL-3000 / Jobo CPA-2. Máy cho phép tráng nhiều cuộn cùng lúc và giữ quy
            trình ổn định, ít sốc film.
          </p>
        </section>
        <section className="ps-section ps-prose">
          <h2>C-41</h2>
          <p>
            C-41 tráng trên Noritsu V-30. Máy được bảo dưỡng đều — chất lượng và tốc độ đi cùng nhau.
          </p>
        </section>
      </div>
    </div>
  );
}
