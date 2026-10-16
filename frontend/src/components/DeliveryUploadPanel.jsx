import { useRef, useState } from 'react';
import api from '../api/client';
import { ticketCode } from '../utils/filmLabels';

export default function DeliveryUploadPanel({ film, onUpdated, onMessage, onError }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [issuedUrl, setIssuedUrl] = useState('');
  const fileCount = film.deliveryFiles?.length || 0;
  const webLink = issuedUrl || film.galleryUrl || '';
  const driveLink = film.driveWebViewLink || null;

  const uploadFiles = async (fileList) => {
    if (!fileList?.length) return;
    const form = new FormData();
    Array.from(fileList).forEach((f) => form.append('files', f));
    setUploading(true);
    onError?.('');
    try {
      const { data } = await api.post(`/films/${film._id}/delivery-files`, form);
      onMessage?.(data.message);
      onUpdated?.();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.response?.status === 404
          ? 'API upload chưa có — hãy restart backend (port 5001)'
          : null) ||
        'Tải ảnh thất bại';
      onError?.(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const syncDrive = async (force = false) => {
    setSyncing(true);
    onError?.('');
    try {
      const { data } = await api.post(`/films/${film._id}/sync-drive`, { force });
      onMessage?.(data.message);
      onUpdated?.();
    } catch (err) {
      onError?.(err.response?.data?.message || 'Đồng bộ Google Drive thất bại');
    } finally {
      setSyncing(false);
    }
  };

  const sendLink = async () => {
    setSending(true);
    onError?.('');
    try {
      const { data } = await api.post(`/films/${film._id}/send-gallery-link`);
      if (data.galleryUrl) setIssuedUrl(data.galleryUrl);
      onMessage?.(data.message);
      if (data.driveError) {
        onError?.(`Drive: ${data.driveError} — đã gửi link web dự phòng (nếu có).`);
      }
      if (data.emailError) onError?.(`Email: ${data.emailError}`);
      onUpdated?.();
    } catch (err) {
      onError?.(err.response?.data?.message || 'Gửi link thất bại');
    } finally {
      setSending(false);
    }
  };

  const busy = uploading || sending || syncing;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-separator)] p-4 bg-[var(--color-bg-secondary)]">
      <div className="flex items-start gap-2">
        <span className="material-symbols-outlined text-[var(--color-blue)]">cloud</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Album ảnh scan</p>
          <p className="text-xs text-[var(--color-label-secondary)] mt-0.5">
            Phiếu {ticketCode(film)} · {fileCount} file
            {webLink ? (
              <span className="font-mono block mt-1 break-all">{webLink}</span>
            ) : null}
          </p>
        </div>
      </div>

      {driveLink && (
        <a
          href={driveLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs text-[var(--color-blue)] break-all underline"
        >
          <span className="material-symbols-outlined text-[16px]">folder_open</span>
          Google Drive
          {film.driveSyncedAt && (
            <span className="text-[var(--color-label-secondary)] no-underline">
              · {new Date(film.driveSyncedAt).toLocaleString('vi-VN')}
            </span>
          )}
        </a>
      )}

      {webLink && (
        <a
          href={webLink}
          target="_blank"
          rel="noreferrer"
          className="block text-xs text-[var(--color-label-secondary)] break-all underline"
        >
          Xem trước web: {webLink}
        </a>
      )}

      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--color-separator)] rounded-xl p-6 cursor-pointer hover:bg-[var(--color-fill-secondary)] transition-colors">
        <span className="material-symbols-outlined text-3xl text-[var(--color-blue)]">
          cloud_upload
        </span>
        <span className="text-sm font-medium">Tải ảnh scan lên server lab</span>
        <span className="text-xs text-[var(--color-label-secondary)] text-center">
          JPG, PNG, WEBP, HEIC, TIFF, PDF — tối đa 40MB/file, 15 file/lần, 200MB tổng
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </label>

      {film.deliveryFiles?.length > 0 && (
        <ul className="text-xs max-h-24 overflow-y-auto space-y-1 text-[var(--color-label-secondary)]">
          {film.deliveryFiles.map((f) => (
            <li key={f.filename} className="truncate">
              {f.originalName || f.filename}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={busy || fileCount === 0}
        onClick={async () => {
          setSending(true);
          onError?.('');
          try {
            const { data } = await api.post(`/films/${film._id}/delivery-link`);
            if (data.galleryUrl) {
              setIssuedUrl(data.galleryUrl);
              try {
                await navigator.clipboard.writeText(data.galleryUrl);
              } catch {
                /* ignore */
              }
            }
            onMessage?.(data.message);
          } catch (err) {
            onError?.(err.response?.data?.message || 'Không tạo được link');
          } finally {
            setSending(false);
          }
        }}
        className="apple-btn-secondary w-full flex items-center justify-center gap-2 text-sm"
      >
        <span className="material-symbols-outlined text-[20px]">link</span>
        Tạo link web (thu hồi link cũ)
      </button>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy || fileCount === 0}
          onClick={() => syncDrive(false)}
          className="apple-btn-tonal w-full flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-[20px]">sync</span>
          {syncing ? 'Đang đẩy Drive...' : 'Đồng bộ Google Drive'}
        </button>
        <button
          type="button"
          disabled={busy || fileCount === 0}
          onClick={sendLink}
          className="apple-btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-[20px]">mail</span>
          {sending ? 'Drive + email...' : 'Gửi link album (Drive)'}
        </button>
      </div>

      <p className="text-[10px] text-center text-[var(--color-label-secondary)]">
        Nút gửi email tự đồng bộ lên Drive (nếu đã cấu hình), rồi gửi link tải — không đính kèm file.
      </p>

      {film.completionEmailSentAt && (
        <p className="text-xs text-center text-emerald-700">
          Đã gửi email: {new Date(film.completionEmailSentAt).toLocaleString('vi-VN')}
        </p>
      )}
    </div>
  );
}
