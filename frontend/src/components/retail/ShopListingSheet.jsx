import { formatShopAdminPrice } from '../../lib/shopFx';
import Modal from '../Modal';
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

export default function ShopListingSheet({ card, onClose, onSave, onSuccess, onOpenProfile, onRestock }) {
  const draft = useShopListingDraft(card);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!card) return null;

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

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(card, draft.payload());
      onSuccess?.(draft.showOnWeb ? 'Đã đăng lên Shop' : 'Đã ẩn khỏi Shop');
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={card.title || 'Sản phẩm'}
      onClose={onClose}
      footer={
        <div className="shop-listing-footer">
          <div className="shop-listing-footer-extra">
            {card.source === 'camera' && onOpenProfile ? (
              <button type="button" className="apple-btn-secondary btn-pill" onClick={() => onOpenProfile(card)}>
                Hồ sơ máy
              </button>
            ) : null}
            {onRestock && (card.source === 'film' || card.source === 'battery' || card.source === 'camera') ? (
              <button type="button" className="apple-btn-secondary btn-pill" onClick={() => onRestock(card)}>
                {card.source === 'camera' ? 'Thêm máy cùng model' : 'Nhập thêm'}
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="apple-btn-secondary btn-pill" onClick={onClose}>
              Hủy
            </button>
            <button type="button" className="apple-btn-primary btn-pill" disabled={saving} onClick={submit}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </div>
      }
    >
      <div className="shop-listing">
        <ShopListingFields draft={draft} hint={hint} />

        <div className="shop-listing-head">
          <p className="shop-listing-brand">{card.brand}</p>
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
      </div>
    </Modal>
  );
}
