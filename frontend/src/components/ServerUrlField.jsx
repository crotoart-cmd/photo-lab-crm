import { useState } from 'react';
import { getApiBaseUrl, setApiBaseUrl } from '../config/apiBase';
import { labelClass, inputClass } from './formFields';

/** URL Mac — tuỳ chọn. Mặc định thu gọn để tablet/iPhone không bị hiểu là bắt buộc server. */
export default function ServerUrlField({ defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [url, setUrl] = useState(() => {
    const base = getApiBaseUrl();
    return base === '/api' ? '' : base;
  });
  const [hint, setHint] = useState('');

  const save = () => {
    const value = url.trim();
    if (!value) {
      setApiBaseUrl('');
      setHint('Đã bỏ URL — app dùng độc lập trên máy');
      return;
    }
    const normalized = value.endsWith('/api') ? value : `${value.replace(/\/$/, '')}/api`;
    setApiBaseUrl(normalized);
    setUrl(normalized);
    setHint('Đã lưu — đồng bộ khi Mac cùng WiFi');
  };

  if (!open) {
    return (
      <div className="mb-4">
        <button
          type="button"
          className="action-btn action-btn--block text-[13px]"
          onClick={() => setOpen(true)}
        >
          Đồng bộ Mac (tuỳ chọn)
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 p-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-separator)]">
      <p className="text-xs font-medium text-[var(--color-label)] mb-2">Đồng bộ Mac (tuỳ chọn)</p>
      <p className="text-[11px] text-[var(--color-label-secondary)] mb-2">
        App chạy độc lập trên máy. Chỉ nhập URL khi muốn backup/đồng bộ với Mac cùng WiFi.
      </p>
      <label className={labelClass}>URL API</label>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="http://192.168.1.10:5001/api"
        className={`${inputClass} text-sm`}
      />
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={save} className="apple-btn-secondary flex-1 text-sm">
          Lưu
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="apple-btn-secondary flex-1 text-sm"
        >
          Đóng
        </button>
      </div>
      {hint && <p className="text-[11px] text-[var(--color-green)] mt-2">{hint}</p>}
    </div>
  );
}
