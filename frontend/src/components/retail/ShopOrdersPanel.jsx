import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { apiErrorMessage } from '../../utils/apiError';
import Modal from '../Modal';
import { LabeledInput } from '../formFields';
import { notifyRetailDataChanged } from '../../lib/seedTestCameras';
import { pingWebInbox } from '../../lib/webInboxPing';
import { formatShopAdminPrice } from '../../lib/shopFx';
const DELIVERY = { pickup: 'Nhận tại tiệm', ship: 'Giao hàng' };
const STATUS = { paid: 'Đã bán', cancelled: 'Đã hủy', expired: 'Hết hạn giữ' };

function timeLeft(holdUntil) {
  const ms = new Date(holdUntil).getTime() - Date.now();
  if (ms <= 0) return 'Hết hạn';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `Còn ${h} giờ ${m} phút` : `Còn ${m} phút`;
}

function OrderLines({ order }) {
  return (
    <ul className="shop-order-lines">
      {order.items.map((line, i) => (
        <li key={i}>
          <span>
            {line.title}
            {line.serial ? <small> · SN {line.serial}</small> : null}
          </span>
          <span>
            {line.quantity > 1 ? `${line.quantity} × ` : ''}
            {formatShopAdminPrice(line.price)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ShopOrdersPanel({ focusId, onError, onSuccess, onChanged }) {
  const [data, setData] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api
        .get('/retail/shop-orders')
        .then(({ data: res }) => setData(res))
        .catch((err) => {
          setData((prev) => prev || { pending: [], done: [] });
          onError?.(apiErrorMessage(err, 'Không tải được đơn web'));
        }),
    [onError]
  );

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      const path = confirm.action === 'paid' ? 'paid' : 'cancel';
      const { data: res } = await api.post(`/retail/shop-orders/${confirm.order._id}/${path}`, {
        reason: confirm.action === 'cancel' ? reason : undefined,
      });
      onSuccess?.(res?.message || 'Đã cập nhật');
      setConfirm(null);
      setReason('');
      await load();
      notifyRetailDataChanged();
      pingWebInbox();
      onChanged?.();
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Không cập nhật được đơn'));
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <p className="intake-stock-empty">Đang tải đơn…</p>;

  return (
    <div className="shop-orders">
      <p className="retail-manual-section-title">Chờ thanh toán</p>
      <p className="text-[12px] text-[var(--color-label-secondary)] -mt-1 mb-3 leading-snug">
        Đơn web giữ hàng 24 giờ. Nhận chuyển khoản hoặc tiền COD rồi bấm Đã nhận tiền — kho mới trừ.
      </p>

      {data.pending.length === 0 ? (
        <p className="intake-stock-empty mb-6">Không có đơn chờ.</p>
      ) : (
        <ul className="shop-order-list mb-6">
          {data.pending.map((order) => (
            <li
              key={order._id}
              className={`shop-order-card${String(order._id) === focusId ? ' is-focus' : ''}`}
            >
              <div className="shop-order-head">
                <span className="intake-stock-row-code">{order.code}</span>
                <span className="shop-order-timer">{timeLeft(order.holdUntil)}</span>
              </div>
              <p className="shop-order-customer">
                {order.customer_name || 'Khách web'}
                {order.customer_phone ? (
                  <a href={`tel:${order.customer_phone}`} onClick={(e) => e.stopPropagation()}>
                    {order.customer_phone}
                  </a>
                ) : null}
              </p>
              <p className="intake-stock-row-meta">
                {DELIVERY[order.delivery] || order.delivery}
                {order.address ? ` · ${order.address}` : ''}
              </p>
              {order.note ? <p className="intake-stock-row-meta">“{order.note}”</p> : null}
              <OrderLines order={order} />
              <div className="shop-order-foot">
                <strong>{formatShopAdminPrice(order.total)}</strong>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="apple-btn-secondary btn-pill text-[13px]"
                    onClick={() => setConfirm({ action: 'cancel', order })}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="apple-btn-primary btn-pill text-[13px]"
                    onClick={() => setConfirm({ action: 'paid', order })}
                  >
                    Đã nhận tiền
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="retail-manual-section-title">Lịch sử</p>
      {data.done.length === 0 ? (
        <p className="intake-stock-empty">Chưa có.</p>
      ) : (
        <ul className="shop-order-history">
          {data.done.map((order) => (
            <li key={order._id}>
              <span className="min-w-0">
                <span className="intake-stock-row-code">{order.code}</span>{' '}
                <span className="truncate">{order.customer_name || 'Khách web'}</span>
              </span>
              <span className={`shop-order-status is-${order.status}`}>{STATUS[order.status]}</span>
              <span className="tabular-nums">{formatShopAdminPrice(order.total)}</span>
            </li>
          ))}
        </ul>
      )}

      {confirm ? (
        <Modal
          compact
          title={confirm.action === 'paid' ? 'Xác nhận đã nhận tiền' : 'Hủy đơn web'}
          onClose={() => (busy ? null : setConfirm(null))}
          footer={
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="apple-btn-secondary btn-pill"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Quay lại
              </button>
              <button
                type="button"
                className={`${confirm.action === 'paid' ? 'apple-btn-primary' : 'apple-btn-destructive'} btn-pill`}
                disabled={busy}
                onClick={run}
              >
                {busy ? 'Đang xử lý…' : confirm.action === 'paid' ? 'Đã nhận tiền — bán' : 'Hủy đơn'}
              </button>
            </div>
          }
        >
          <p className="text-[15px] mb-2">
            {confirm.order.code} · {confirm.order.customer_name || 'Khách web'}
          </p>
          <OrderLines order={confirm.order} />
          <p className="text-[15px] font-semibold mt-2">{formatShopAdminPrice(confirm.order.total)}</p>
          {confirm.action === 'paid' ? (
            <p className="text-[13px] text-[var(--color-label-secondary)] mt-2">
              Kho trừ ngay, ghi doanh thu kênh online.
            </p>
          ) : (
            <div className="mt-3">
              <LabeledInput
                label="Lý do (tuỳ chọn)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Khách không chuyển khoản…"
              />
              <p className="text-[13px] text-[var(--color-label-secondary)] mt-2">Hàng trả lại kho, hiện lại trên web.</p>
            </div>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
