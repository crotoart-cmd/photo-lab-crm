export default function PublicScan() {
  return (
    <div className="ps-page">
      <section className="ps-page-hero">
        <p className="ps-kicker">Dịch vụ</p>
        <h1>Scan</h1>
        <p className="ps-lede">Hai hướng: scan hi-end từng khung, và scan hàng loạt 135 / 120.</p>
      </section>

      <div className="ps-body">
        <section className="ps-section ps-prose">
          <h2>Scan hi-end</h2>
          <p>
            Heidelberg Nexscan F4100 — scan phẳng, quang học tới 5000 dpi. Film mọi format, Polaroid, kính, bản không
            trong suốt tới A3. Negative áp sát kính, nét đều khung. Kính phủ anti-Newton; sâu màu 16-bit TIFF và 8-bit
            JPEG.
          </p>
          <p className="ps-note">
            Máy không có Digital ICE. Bụi có thể còn trên file; lab thổi negative và kính trước khi scan, retouch khi
            thỏa thuận.
          </p>
        </section>

        <section className="ps-section ps-prose">
          <h2>Scan hàng loạt</h2>
          <p>
            Noritsu HS-1800, Fuji SP-500 và Fuji SP-3000 — máy nhanh cho 135 và 120. Digital ICE (bụi/xước) với film
            màu; đen trắng không dùng được ICE.
          </p>
          <p>
            Lab thổi negative trước khi đưa máy. Không có câu trả lời “Noritsu hay Frontier hơn” cho mọi cuộn.
          </p>
          <ul className="ps-list">
            <li>Noritsu: tối đa khoảng 4500 × 6700 px, không scan kèm khung đục lỗ.</li>
            <li>
              Frontier: tối đa khoảng 3600 × 5400 px, có thể kèm khung — lấy 100% ảnh và một phần perforation.
            </li>
            <li>Hai dòng máy khác màu, khác sáng/tối. Chọn theo từng đơn.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
