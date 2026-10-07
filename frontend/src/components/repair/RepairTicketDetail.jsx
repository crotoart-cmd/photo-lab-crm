import { useState } from 'react';
import { apiErrorMessage } from '../../utils/apiError';
import { REPAIR_STATUS_LABELS, formatRepairMoney } from '../../constants/customerRepair';
import { LabeledInput, LabeledTextarea } from '../formFields';
import {
  quoteRepairBridge,
  confirmRepairBridge,
  workLogRepairBridge,
  readyRepairBridge,
  returnRepairBridge,
  cancelRepairBridge,
} from '../../lib/mobileRepairBridge';

export default function RepairTicketDetail({ ticket, onUpdated, onError, onSuccess }) {
  const [busy, setBusy] = useState('');
  const [quoteForm, setQuoteForm] = useState({
    quote_amount: '',
    quote_note: '',
    deposit_amount: '',
  });
  const [workForm, setWorkForm] = useState({
    description: '',
    vendor: '',
    parts_cost: '',
    labor_cost: '',
  });

  if (!ticket) {
    return (
      <div className="apple-card p-6 text-center text-sm text-[var(--color-label-secondary)]">
        Chọn phiếu để xem chi tiết
      </div>
    );
  }

  const run = async (key, fn) => {
    setBusy(key);
    try {
      const result = await fn();
      onSuccess?.(result?.message || 'Đã cập nhật');
      onUpdated?.(result?.ticket);
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Thao tác thất bại'));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="apple-card p-5 space-y-4">
      <header>
        <p className="text-xs text-[var(--color-label-tertiary)] font-mono">{ticket.ticket_number}</p>
        <h2 className="text-lg font-semibold text-[var(--color-label)]">{ticket.model_name}</h2>
        <p className="text-sm text-[var(--color-label-secondary)]">
          {ticket.customer_name} · {ticket.customer_email}
        </p>
        {ticket.customer_phone && (
          <p className="text-sm text-[var(--color-label-secondary)]">{ticket.customer_phone}</p>
        )}
        <p className="text-sm mt-2">
          <span className="font-medium">{REPAIR_STATUS_LABELS[ticket.status]}</span>
          {ticket.serial_number ? ` · SN ${ticket.serial_number}` : ''}
        </p>
      </header>

      <section className="text-sm space-y-1 border-t border-[var(--color-separator)] pt-3">
        <p>
          <span className="text-[var(--color-label-secondary)]">Triệu chứng: </span>
          {ticket.symptom}
        </p>
        {ticket.condition_at_intake && (
          <p>
            <span className="text-[var(--color-label-secondary)]">Tình trạng nhận: </span>
            {ticket.condition_at_intake}
          </p>
        )}
        {ticket.intake_note && (
          <p>
            <span className="text-[var(--color-label-secondary)]">Ghi chú: </span>
            {ticket.intake_note}
          </p>
        )}
      </section>

      {(ticket.quote_amount > 0 || ticket.status === 'tiep_nhan' || ticket.status === 'cho_khach_xac_nhan') && (
        <section className="border-t border-[var(--color-separator)] pt-3 space-y-2">
          <h3 className="text-sm font-semibold">Báo giá</h3>
          {ticket.quote_amount > 0 ? (
            <p className="text-sm">
              {formatRepairMoney(ticket.quote_amount)}
              {ticket.deposit_amount > 0 ? ` · Cọc ${formatRepairMoney(ticket.deposit_amount)}` : ''}
            </p>
          ) : null}
          {(ticket.status === 'tiep_nhan' || ticket.status === 'cho_khach_xac_nhan') && (
            <div className="space-y-2">
              <LabeledInput
                label="Tổng báo giá (VNĐ)"
                type="text"
                inputMode="numeric"
                value={quoteForm.quote_amount}
                onChange={(e) =>
                  setQuoteForm((f) => ({ ...f, quote_amount: e.target.value.replace(/\D/g, '') }))
                }
              />
              <LabeledInput
                label="Cọc (VNĐ)"
                type="text"
                inputMode="numeric"
                value={quoteForm.deposit_amount}
                onChange={(e) =>
                  setQuoteForm((f) => ({ ...f, deposit_amount: e.target.value.replace(/\D/g, '') }))
                }
              />
              <LabeledTextarea
                label="Ghi chú báo giá"
                rows={2}
                value={quoteForm.quote_note}
                onChange={(e) => setQuoteForm((f) => ({ ...f, quote_note: e.target.value }))}
              />
              <button
                type="button"
                disabled={busy === 'quote'}
                className="apple-btn-primary w-full"
                onClick={() =>
                  run('quote', () =>
                    quoteRepairBridge(ticket._id, {
                      quote_amount: Number(quoteForm.quote_amount) || 0,
                      deposit_amount: Number(quoteForm.deposit_amount) || 0,
                      quote_note: quoteForm.quote_note,
                    })
                  )
                }
              >
                {busy === 'quote' ? 'Đang gửi…' : 'Gửi báo giá & email khách'}
              </button>
            </div>
          )}
          {ticket.status === 'cho_khach_xac_nhan' && (
            <button
              type="button"
              disabled={busy === 'confirm'}
              className="apple-btn-secondary w-full"
              onClick={() => run('confirm', () => confirmRepairBridge(ticket._id))}
            >
              {busy === 'confirm' ? 'Đang lưu…' : 'Xác nhận tại quầy'}
            </button>
          )}
        </section>
      )}

      {ticket.status === 'dang_sua' && (
        <section className="border-t border-[var(--color-separator)] pt-3 space-y-2">
          <h3 className="text-sm font-semibold">Nhật ký sửa (chi phí nội bộ)</h3>
          <p className="text-xs text-[var(--color-label-tertiary)]">
            Đã chi: {formatRepairMoney(ticket.internal_total_cost || 0)}
          </p>
          <LabeledInput
            label="Mô tả công việc"
            value={workForm.description}
            onChange={(e) => setWorkForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput
              label="Linh kiện"
              inputMode="numeric"
              value={workForm.parts_cost}
              onChange={(e) =>
                setWorkForm((f) => ({ ...f, parts_cost: e.target.value.replace(/\D/g, '') }))
              }
            />
            <LabeledInput
              label="Công"
              inputMode="numeric"
              value={workForm.labor_cost}
              onChange={(e) =>
                setWorkForm((f) => ({ ...f, labor_cost: e.target.value.replace(/\D/g, '') }))
              }
            />
          </div>
          <button
            type="button"
            disabled={busy === 'work'}
            className="apple-btn-secondary w-full"
            onClick={() =>
              run('work', () =>
                workLogRepairBridge(ticket._id, {
                  description: workForm.description,
                  vendor: workForm.vendor,
                  parts_cost: Number(workForm.parts_cost) || 0,
                  labor_cost: Number(workForm.labor_cost) || 0,
                })
              )
            }
          >
            {busy === 'work' ? 'Đang lưu…' : 'Thêm nhật ký'}
          </button>
          <button
            type="button"
            disabled={busy === 'ready'}
            className="apple-btn-primary w-full"
            onClick={() => run('ready', () => readyRepairBridge(ticket._id, {}))}
          >
            {busy === 'ready' ? 'Đang gửi…' : 'Sửa xong — email chờ trả'}
          </button>
        </section>
      )}

      {ticket.status === 'cho_tra' && (
        <section className="border-t border-[var(--color-separator)] pt-3">
          <p className="text-sm mb-2">
            Còn thu: <strong>{formatRepairMoney(ticket.amount_due)}</strong>
          </p>
          <button
            type="button"
            disabled={busy === 'return'}
            className="apple-btn-primary w-full"
            onClick={() => run('return', () => returnRepairBridge(ticket._id, {}))}
          >
            {busy === 'return' ? 'Đang lưu…' : 'Đã trả máy cho khách'}
          </button>
        </section>
      )}

      {ticket.work_logs?.length > 0 && (
        <section className="border-t border-[var(--color-separator)] pt-3">
          <h3 className="text-sm font-semibold mb-2">Lịch sử sửa</h3>
          <ul className="space-y-2 text-sm">
            {ticket.work_logs.map((w) => (
              <li key={w._id} className="border-b border-[var(--color-separator)] pb-2 last:border-0">
                <p className="font-medium">{w.description}</p>
                <p className="text-xs text-[var(--color-label-secondary)]">
                  {formatRepairMoney(w.total_cost)}
                  {w.vendor ? ` · ${w.vendor}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!['da_tra', 'da_huy', 'khach_tu_choi'].includes(ticket.status) && (
        <button
          type="button"
          disabled={busy === 'cancel'}
          className="apple-btn-ghost w-full text-[var(--color-red)]"
          onClick={() => run('cancel', () => cancelRepairBridge(ticket._id))}
        >
          Hủy phiếu
        </button>
      )}
    </div>
  );
}
