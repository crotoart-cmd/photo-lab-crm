import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppleMenuItem, AppleMenuPanel, useAppleMenuPosition } from './AppleMenu';
import { useWebInbox } from '../context/WebInboxContext';

function formatWhen(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}

export function NavCountBadge({ count }) {
  if (!count) return null;
  return (
    <span className="apple-nav-badge" aria-label={`${count} đơn web chờ`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default function AdminWebInbox({ variant = 'nav' }) {
  const navigate = useNavigate();
  const { total, items, filmCount, repairCount, shopCount } = useWebInbox();
  const [open, setOpen] = useState(false);
  const { anchorRef, menuStyle } = useAppleMenuPosition({
    open,
    onOpenChange: setOpen,
    align: 'start',
    minWidth: 300,
  });

  const go = (href) => {
    setOpen(false);
    navigate(href);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={variant === 'toolbar' ? 'sub-nav-bar-action relative' : 'apple-nav-item'}
        aria-label={total ? `${total} đơn web chờ nhận hàng` : 'Đơn web'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined" aria-hidden>
          notifications
        </span>
        {variant === 'nav' ? <span className="apple-nav-item__label">Đơn web</span> : null}
        <NavCountBadge count={total} />
      </button>
      <AppleMenuPanel menuStyle={menuStyle} role="menu">
        <p className="apple-menu__section-label px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-label-secondary)]">
          {total ? `Chờ nhận hàng · ${total}` : 'Không có đơn web chờ'}
        </p>
        {total > 0 ? (
          <div className="px-3 pb-1 text-xs text-[var(--color-label-tertiary)]">
            {[
              filmCount ? `${filmCount} film` : '',
              repairCount ? `${repairCount} sửa máy` : '',
              shopCount ? `${shopCount} đơn mua` : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        ) : null}
        {items.length === 0 ? (
          <p className="px-3 py-3 text-sm text-[var(--color-label-secondary)]">
            Đơn mới từ website sẽ hiện ở đây cho tới khi lab xử lý.
          </p>
        ) : (
          items.map((row) => (
            <AppleMenuItem
              key={`${row.kind}-${row.id}`}
              meta={formatWhen(row.createdAt)}
              onClick={() => go(row.href)}
            >
              {{ film: 'Film', repair: 'Sửa máy', shop: 'Mua hàng' }[row.kind] || 'Đơn'} · {row.code} ·{' '}
              {row.customer}
            </AppleMenuItem>
          ))
        )}
        {filmCount > 0 ? (
          <AppleMenuItem onClick={() => go('/films?tab=receive')}>Mở phiếu film</AppleMenuItem>
        ) : null}
        {repairCount > 0 ? (
          <AppleMenuItem onClick={() => go('/repairs?status=don_web')}>Mở sửa máy</AppleMenuItem>
        ) : null}
        {shopCount > 0 ? (
          <AppleMenuItem onClick={() => go('/retail?tab=orders')}>Mở đơn mua</AppleMenuItem>
        ) : null}
      </AppleMenuPanel>
    </>
  );
}
