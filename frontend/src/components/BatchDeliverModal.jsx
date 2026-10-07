import Modal from './Modal';
import { customerName, ticketCode } from '../utils/filmLabels';

export default function BatchDeliverModal({ films, onClose, onSubmit, loading }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(films.map((f) => f._id));
  };

  return (
    <Modal wide title={`Xác nhận trả ảnh (${films.length} phiếu)`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-[var(--color-label-secondary)]">
          Admin xác nhận trả ảnh — hệ thống gửi email thông báo cho từng khách (không cần mã xác nhận).
        </p>
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {films.map((film) => (
            <li
              key={film._id}
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-separator)] bg-[var(--color-bg-secondary)]"
            >
              <span className="material-symbols-outlined text-[var(--md-sys-color-tertiary)]">
                photo_library
              </span>
              <div>
                <p className="font-mono text-sm font-bold">{ticketCode(film)}</p>
                <p className="text-xs text-[var(--color-label-secondary)]">
                  {customerName(film)}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <button type="submit" disabled={loading} className="apple-btn-primary w-full">
          {loading ? 'Đang xử lý...' : `Xác nhận trả ${films.length} phiếu & gửi email`}
        </button>
      </form>
    </Modal>
  );
}
