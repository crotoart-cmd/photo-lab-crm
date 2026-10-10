import { SPEED_EXPRESS, SPEED_STANDARD } from '../data/publicLabServices';

export default function PublicSpeed() {
  return (
    <div className="ps-page">
      <section className="ps-page-hero">
        <p className="ps-kicker">Dịch vụ</p>
        <h1>Tốc độ</h1>
        <p className="ps-lede">Thời gian tráng, scan và in — tiêu chuẩn và gấp. Cộng thêm nếu tráng riêng từng cuộn.</p>
      </section>

      <div className="ps-body">
        <section className="ps-section">
          <h2>Tráng và scan</h2>
          <table className="ps-table">
            <thead>
              <tr>
                <th>Quy trình</th>
                <th>Tiêu chuẩn</th>
              </tr>
            </thead>
            <tbody>
              {SPEED_STANDARD.map((row) => (
                <tr key={row.process}>
                  <td>{row.process}</td>
                  <td>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="ps-section">
          <h2>Gấp</h2>
          <table className="ps-table">
            <thead>
              <tr>
                <th>Quy trình</th>
                <th>Gấp</th>
              </tr>
            </thead>
            <tbody>
              {SPEED_EXPRESS.map((row) => (
                <tr key={row.process}>
                  <td>{row.process}</td>
                  <td>{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ps-note">Tráng riêng từng cuộn: cộng 48 giờ.</p>
        </section>

        <section className="ps-section">
          <h2>Lưu trữ</h2>
          <ul className="ps-list">
            <li>Giữ negative: 30 ngày kể từ lúc gửi cuộn.</li>
            <li>Link ảnh: 30 ngày kể từ lúc đơn sẵn sàng.</li>
            <li>In quang học: tối đa 7 ngày.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
