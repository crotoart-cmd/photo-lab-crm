import Modal from '../Modal';
import LoadingIndicator from '../LoadingIndicator';
import CustomerTagPill, { LtvBadge } from './CustomerTagPill';
import { fullName } from '../../utils/customerNormalize';

const formatMoney = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function Customer360Modal({ open, profile, loading, onClose }) {
  if (!open) return null;

  const customer = profile?.customer;
  const stats = profile?.stats || customer?.stats;
  const timeline = profile?.timeline || [];

  return (
    <Modal title="Chi tiết khách hàng" onClose={onClose} wide>
      {loading && !customer ? (
        <LoadingIndicator label="Đang tải hồ sơ..." />
      ) : !customer ? (
        <p className="text-sm text-[var(--color-label-secondary)]">Không tải được hồ sơ khách.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--color-label)]">{fullName(customer)}</h2>
                <LtvBadge grade={profile?.ltvGrade || customer.ltvGrade} />
              </div>
              <p className="text-sm text-[var(--color-label-secondary)] mt-1">
                {customer.customerCode || '—'} · {customer.phone} · {customer.email}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(profile?.tags || customer.tags || []).map((tag) => (
                  <CustomerTagPill key={tag.id} tag={tag} />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Lần ghé gần nhất" value={formatDate(stats?.lastVisit)} />
            <Stat label="Tổng chi tiêu" value={formatMoney(stats?.totalSpend)} />
            <Stat label="Chi tiêu 90 ngày" value={formatMoney(stats?.spend90d)} />
            <Stat label="Phiếu film" value={stats?.visitCount ?? 0} />
            <Stat label="Đơn bán lẻ" value={stats?.retailCount ?? 0} />
            <Stat label="Doanh thu bán lẻ" value={formatMoney(stats?.retailSpend)} />
            <Stat label="Sở thích film" value={stats?.favoriteProcess || '—'} />
            <Stat label="Nợ/chưa trả" value={formatMoney(stats?.unpaidAmount)} danger={stats?.unpaidAmount > 0} />
          </div>

          {customer.notes && (
            <section className="apple-card-filled p-3">
              <p className="text-xs font-semibold text-[var(--color-label-secondary)] mb-1">
                Ghi chú nội bộ
              </p>
              <p className="text-[11px] text-[var(--color-label-tertiary)] mb-2">
                Không gửi trong email cho khách
              </p>
              <p className="text-sm whitespace-pre-wrap">{customer.notes}</p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-[var(--color-label)] mb-3">Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-[var(--color-label-secondary)]">Chưa có lịch sử.</p>
            ) : (
              <ul className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {timeline.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <div className="w-2 mt-2 h-2 rounded-full bg-[var(--color-blue)] shrink-0" />
                    <div className="min-w-0 flex-1 border-b border-[var(--color-separator)] pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--color-label)]">{item.title}</p>
                        <span className="text-[11px] text-[var(--color-label-tertiary)]">
                          {formatDate(item.at)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-label-secondary)] mt-0.5">{item.subtitle}</p>
                      {item.amount > 0 && (
                        <p className="text-xs font-medium text-[var(--color-green)] mt-1">
                          {formatMoney(item.amount)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, danger }) {
  return (
    <div className="apple-card-filled p-3">
      <p className="text-[11px] text-[var(--color-label-tertiary)]">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${danger ? 'text-[var(--color-red)]' : 'text-[var(--color-label)]'}`}>
        {value}
      </p>
    </div>
  );
}
