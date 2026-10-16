import { formatShopAdminPrice } from '../../lib/shopFx';
import { apiErrorMessage } from '../../utils/apiError';
import ShopListingFields, { useShopListingDraft } from './ShopListingFields';
import { useState } from 'react';

export function WebPill({ card, online, onOpen }) {
  if (!online) return null;
  if (!card) {
    return (
      <span className="shop-web-pill is-off" title="Món này chưa đồng bộ lên máy chủ">
        Chưa đồng bộ
      </span>
    );
  }
  const label = card.reserved > 0 ? `Giữ ${card.reserved}` : card.showOnWeb ? 'Web' : 'Ẩn';
  return (
    <button
      type="button"
      className={`shop-web-pill${card.showOnWeb ? ' is-on' : ''}${card.reserved > 0 ? ' is-held' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(card);
      }}
    >
      {label}
    </button>
  );
}

export function ShopListingEmpty() {
  return (
    <div className="shop-listing-empty-pane">
      <p>Chọn sản phẩm</p>
      <small>Ảnh, mô tả và đăng web hiện bên đây.</small>
    </div>
  );
}

export default function ShopListingSheet({ card, onClose, onSave, onSuccess, onOpenProfile, onRestock }) {
  const draft = useShopListingDraft(card);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!card) return <ShopListingEmpty />;

  const expiry =
    card.source === 'film' && card.expiry
      ? `HSD ${new Date(card.expiry).toLocaleDateString('vi-VN')}${
          card.daysLeft != null ? ` · còn ${card.daysLeft} ngày` : ''
        }`
      : '';
  const held = card.source === 'film' ? card.skuReserved || 0 : card.reserved || 0;
  const hint =
    card.source === 'film'
      ? 'Bật riêng từng lô — lô sắp hết hạn có thể tắt.'
      : 'Khách đặt trên web, lab xác nhận ở tab Đơn.';
  const cover = card.image || draft.slots[0]?.src;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await onSave(card, draft.payload());
      const next = Array.isArray(res?.items)
        ? res.items.find((row) => row.source === card.source && String(row.id) === String(card.id))
        : null;
      if (next) draft.reset(next);
      onSuccess?.(draft.showOnWeb ? 'Đã đăng lên Shop' : 'Đã ẩn khỏi Shop');
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shop-listing shop-listing--pane">
      {onClose ? (
        <button type="button" className="shop-listing-back" onClick={onClose}>
          ← Kho
        </button>
      ) : null}

      <div className="shop-listing-hero">
        {cover ? <img src={cover} alt="" /> : <span className="shop-listing-hero-empty" aria-hidden="true" />}
      </div>

      <div className="shop-listing-head">
        {card.brand ? <p className="shop-listing-brand">{card.brand}</p> : null}
        <h2 className="shop-listing-title">{card.title || 'Sản phẩm'}</h2>
        <p className="shop-listing-meta">
          {formatShopAdminPrice(card.price)} · còn {card.quantity}
          {card.serial ? ` · SN ${card.serial}` : ''}
        </p>
        {expiry ? (
          <p
            className={`shop-listing-meta${
              card.daysLeft < 0 ? ' is-dead' : card.daysLeft <= 60 ? ' is-warn' : ''
            }`}
          >
            {expiry}
          </p>
        ) : null}
      </div>

      <ShopListingFields draft={draft} hint={hint} />

      {held > 0 ? (
        <p className="shop-listing-held">
          {held} đang giữ cho đơn web{card.reservedCodes?.length ? ` ${card.reservedCodes.join(', ')}` : ''} —
          xác nhận ở tab Đơn.
        </p>
      ) : null}

      {error ? (
        <p className="text-[13px] text-[var(--color-red)]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="shop-listing-footer">
        <div className="shop-listing-footer-extra">
          {card.source === 'camera' && onOpenProfile ? (
            <button type="button" className="btn-pill btn-pill--36 btn-pill--lv4" onClick={() => onOpenProfile(card)}>
              Hồ sơ máy
            </button>
          ) : null}
          {onRestock && (card.source === 'film' || card.source === 'battery' || card.source === 'camera') ? (
            <button type="button" className="btn-pill btn-pill--36 btn-pill--lv4" onClick={() => onRestock(card)}>
              Nhập thêm
            </button>
          ) : null}
        </div>
        <button type="button" className="btn-pill btn-pill--36 btn-pill--lv1" disabled={saving} onClick={submit}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </div>
  );
}
