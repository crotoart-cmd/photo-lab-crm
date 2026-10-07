import { useState } from 'react';
import { labelClass, textareaClass } from './formFields';
import ProgressTimeline from './ProgressTimeline';
import StatusPill from './StatusPill';
import IntakeChecklistView from './IntakeChecklistView';
import DeliveryUploadPanel from './DeliveryUploadPanel';
import {
  STATUS_LABELS,
  customerEmail,
  customerName,
  customerPhone,
  filmTypeLabel,
  FILM_STATUS_PILL,
  ticketCode,
} from '../utils/filmLabels';
import { updateFilmStatusBridge } from '../lib/mobileFilmLabBridge';

export default function TicketDetailPanel({ film, onUpdated, onClose, focusDeliver = false }) {
  const [processingNotes, setProcessingNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const runAction = async (fn) => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await fn();
      onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Thao tác thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleStartProcessing = () =>
    runAction(async () => {
      const data = await updateFilmStatusBridge(film._id, 'processing', { note: 'Bắt đầu tráng' });
      setMessage(data.message);
      if (data.emailError) setError(`Email: ${data.emailError}`);
    });

  const handleComplete = () =>
    runAction(async () => {
      const data = await updateFilmStatusBridge(film._id, 'completed', {
        processingNotes: processingNotes || 'Hoàn thành tráng',
      });
      setMessage(data.message);
      if (data.galleryUrl) {
        setMessage(`${data.message} · Folder: ${data.galleryUrl}`);
      }
    });

  const handleDeliver = () =>
    runAction(async () => {
      const data = await updateFilmStatusBridge(film._id, 'delivered', {});
      setMessage(data.message);
    });

  return (
    <div className="apple-card p-5 h-full flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs text-[var(--color-label-secondary)]">Mã phiếu</p>
          <h2 className="font-mono text-xl font-bold text-[var(--color-label)]">
            {ticketCode(film)}
          </h2>
          <StatusPill variant={FILM_STATUS_PILL[film.status] || 'active'} className="mt-1">
            {STATUS_LABELS[film.status]}
          </StatusPill>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="apple-btn-ghost !p-2">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div>
          <dt className="text-[var(--color-label-secondary)]">Khách hàng</dt>
          <dd className="font-medium">{customerName(film)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-label-secondary)]">SĐT</dt>
          <dd>{customerPhone(film)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[var(--color-label-secondary)]">Email</dt>
          <dd className="text-xs break-all">{customerEmail(film)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-label-secondary)]">Loại / SL</dt>
          <dd>
            {filmTypeLabel(film.filmType)} · {film.quantity} cuộn
          </dd>
        </div>
      </dl>

      {film.intakeChecklist && (
        <details className="mb-4 border border-[var(--color-separator)] rounded-xl p-3">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--color-blue)]">
            Checklist tiếp nhận (develop & scan)
          </summary>
          <div className="mt-3 max-h-64 overflow-y-auto">
            <IntakeChecklistView checklist={film.intakeChecklist} />
          </div>
        </details>
      )}

      <div className="mb-4">
        <p className="text-xs font-medium text-[var(--color-label-secondary)] mb-2">Tiến độ tráng</p>
        <ProgressTimeline film={film} />
      </div>

      {message && <div className="apple-alert-success mb-3">{message}</div>}
      {error && <div className="apple-alert-error mb-3">{error}</div>}

      <div className="mt-auto space-y-3 border-t border-[var(--color-separator)] pt-4">
        {film.status === 'received' && (
          <button
            type="button"
            disabled={loading}
            onClick={handleStartProcessing}
            className="apple-btn-tonal w-full"
          >
            Bắt đầu tráng
          </button>
        )}

        {film.status === 'processing' && (
          <>
            <label className={labelClass}>Ghi chú hoàn thành</label>
            <textarea
              value={processingNotes}
              onChange={(e) => setProcessingNotes(e.target.value)}
              placeholder="Ghi chú tùy chọn..."
              className={textareaClass}
              rows={2}
            />
            <button
              type="button"
              disabled={loading}
              onClick={handleComplete}
              className="apple-btn-primary w-full"
            >
              Hoàn thành tráng & tạo folder ảnh
            </button>
          </>
        )}

        {film.status === 'completed' && (
          <>
            <DeliveryUploadPanel
              film={film}
              onUpdated={onUpdated}
              onMessage={setMessage}
              onError={setError}
            />
          <div
            className={
              focusDeliver
                ? 'ring-2 ring-[var(--color-blue)] rounded-xl p-3 -m-1 bg-[rgba(0,122,255,0.12)]/30'
                : ''
            }
          >
            <p className="text-sm text-[var(--color-label-secondary)] mb-3">
              Sau khi khách đã nhận ảnh (online hoặc tại quầy) — xác nhận đã trả.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={handleDeliver}
              className="apple-btn-primary w-full flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              Xác nhận đã trả ảnh
            </button>
          </div>
          </>
        )}

        {film.status === 'delivered' && (
          <div className="apple-alert-success text-center">
            <span className="material-symbols-outlined align-middle mr-1">task_alt</span>
            Đã trả ảnh thành công
            {film.deliveredAt && (
              <p className="text-xs mt-1 opacity-90">
                {new Date(film.deliveredAt).toLocaleString('vi-VN')}
              </p>
            )}
            {film.deliveryEmailSentAt && (
              <p className="text-xs mt-1">Email đã gửi: {new Date(film.deliveryEmailSentAt).toLocaleString('vi-VN')}</p>
            )}
          </div>
        )}

        {film.completionEmailSentAt && film.status !== 'delivered' && (
          <p className="text-xs text-[var(--color-label-secondary)] text-center">
            Đã gửi link folder: {new Date(film.completionEmailSentAt).toLocaleString('vi-VN')}
          </p>
        )}
      </div>
    </div>
  );
}
