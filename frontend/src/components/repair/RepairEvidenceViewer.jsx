import { useEffect, useRef, useState } from 'react';
import { Download, Eye, FileImage, FileVideo, RotateCw } from 'lucide-react';
import api from '../../api/client';
import { getServerRepairId } from '../../lib/mobileRepairBridge';
import { formatRepairMediaSize, repairMediaKind } from '../../lib/repairMedia';
import { apiErrorMessage } from '../../utils/apiError';
import { RepairMediaDialog } from '../public/RepairMediaPicker';

const dateText = (value) => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN') : '-';
};
const mediaKind = (item) => repairMediaKind({ name: item.original_name, type: item.mime_type });
const unsupportedText = 'Trình duyệt không xem được ảnh hoặc codec video này. Hãy tải tệp gốc để mở bằng ứng dụng phù hợp.';
const evidenceError = (error, fallback) => error.response ? apiErrorMessage(error, fallback) : fallback;

function EvidenceMetadata({ item }) {
  return <dl className="repair-evidence-meta">
    <div><dt>Loại / dung lượng</dt><dd>{item.mime_type || '-'} · {formatRepairMediaSize(item.size)}</dd></div>
    <div><dt>Tải lên</dt><dd>{dateText(item.uploaded_at)}</dd></div>
    <div><dt>Nguồn</dt><dd>{item.source === 'customer' ? 'Khách hàng (customer)' : item.source || '-'}</dd></div>
    <div><dt>SHA-256</dt><dd><code>{item.sha256 || '-'}</code></dd></div>
  </dl>;
}

export default function RepairEvidenceViewer({ ticket }) {
  const files = Array.isArray(ticket.intake_media) ? ticket.intake_media : [];
  const snapshot = ticket.customer_submission;
  const serverId = getServerRepairId(ticket._id);
  const [selected, setSelected] = useState(null);
  const [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState({ loading: false, url: '', error: '', unsupported: false });
  const [downloading, setDownloading] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const downloadController = useRef(null);
  const downloads = useRef(new Map());

  const releaseDownloads = () => {
    const controller = downloadController.current;
    downloadController.current = null;
    controller?.abort();
    downloads.current.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); });
    downloads.current.clear();
  };
  useEffect(() => () => releaseDownloads(), []);

  useEffect(() => {
    if (!selected || !serverId) return undefined;
    const kind = mediaKind(selected);
    if (!kind) {
      setPreview({ loading: false, url: '', error: '', unsupported: true });
      return undefined;
    }
    const controller = new AbortController();
    let objectUrl = '';
    setPreview({ loading: true, url: '', error: '', unsupported: false });
    api.get(`/repairs/${encodeURIComponent(serverId)}/media/${encodeURIComponent(selected.id)}`, {
      responseType: 'blob', signal: controller.signal, timeout: 120000,
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      if (!(data instanceof Blob) || !data.size || data.type.includes('application/json') || data.type.includes('text/html')) throw new Error('Không nhận được tệp ảnh / video.');
      objectUrl = URL.createObjectURL(new Blob([data], { type: selected.mime_type || data.type }));
      setPreview({ loading: false, url: objectUrl, error: '', unsupported: false });
    }).catch((error) => {
      if (!controller.signal.aborted) setPreview({ loading: false, url: '', error: evidenceError(error, 'Không tải được tệp. Kiểm tra kết nối máy chủ và thử lại.'), unsupported: false });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected, serverId, retry]);

  const closePreview = () => {
    setSelected(null);
    setPreview({ loading: false, url: '', error: '', unsupported: false });
    setDownloadError('');
    setDownloading('');
    releaseDownloads();
  };

  const downloadOriginal = async (item) => {
    if (!serverId || downloadController.current) return;
    const controller = new AbortController();
    downloadController.current = controller;
    setDownloading(item.id);
    setDownloadError('');
    try {
      const { data } = await api.get(`/repairs/${encodeURIComponent(serverId)}/media/${encodeURIComponent(item.id)}`, {
        params: { download: 1 }, responseType: 'blob', signal: controller.signal, timeout: 120000,
      });
      if (controller.signal.aborted) return;
      if (!(data instanceof Blob) || !data.size || data.type.includes('application/json') || data.type.includes('text/html')) throw new Error('Không nhận được tệp gốc.');
      const url = URL.createObjectURL(data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.original_name || 'repair-media';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      const timer = setTimeout(() => { URL.revokeObjectURL(url); downloads.current.delete(url); }, 1000);
      downloads.current.set(url, timer);
    } catch (error) {
      if (!controller.signal.aborted) setDownloadError(evidenceError(error, 'Không tải được tệp gốc. Kiểm tra kết nối máy chủ và thử lại.'));
    } finally {
      if (downloadController.current === controller) {
        downloadController.current = null;
        setDownloading('');
      }
    }
  };

  const downloadButton = (item) => <button type="button" className="repair-media-add" disabled={Boolean(downloading) || !serverId} onClick={() => downloadOriginal(item)} aria-label={`Tải tệp gốc: ${item.original_name}`} title="Tải tệp gốc"><Download size={18} aria-hidden="true" />{downloading === item.id ? 'Đang tải…' : 'Tải tệp gốc'}</button>;

  if (!snapshot && !files.length && serverId) return null;
  return <section className="repair-evidence" aria-label="Tài liệu khách gửi ban đầu">
    <h3>Khách gửi ban đầu</h3>
    {snapshot ? <dl className="repair-evidence-snapshot">
      <div><dt>Ngày gửi</dt><dd>{dateText(snapshot.submitted_at)}</dd></div>
      <div><dt>Máy / hãng</dt><dd>{[snapshot.model_name, snapshot.brand].filter(Boolean).join(' / ') || '-'}</dd></div>
      <div><dt>Sê-ri khách khai</dt><dd>{snapshot.serial_number || '-'}</dd></div>
      <div><dt>Triệu chứng khách khai</dt><dd>{snapshot.symptom || '-'}</dd></div>
      <div><dt>Tình trạng khách khai trước khi gửi máy</dt><dd>{snapshot.condition_at_intake || 'Khách không mô tả.'}</dd></div>
    </dl> : null}
    <h4>Ảnh / video khách đính kèm ({files.length})</h4>
    {!serverId ? <p className="repair-media-hint">Tệp đính kèm cần kết nối máy chủ. Phiếu này hiện chỉ có trên thiết bị.</p> : null}
    {!files.length ? <p className="repair-media-hint">Không có tệp đính kèm.</p> : <ul className="repair-evidence-list">{files.map((item) => {
      const Icon = mediaKind(item) === 'video' ? FileVideo : FileImage;
      return <li key={item.id}>
        <div className="repair-evidence-name"><Icon size={20} aria-hidden="true" /><strong>{item.original_name}</strong></div>
        <EvidenceMetadata item={item} />
        <div className="repair-evidence-actions">
          <button type="button" className="repair-media-add" disabled={!serverId} aria-label={`Xem: ${item.original_name}`} onClick={() => {
            setPreview({ loading: true, url: '', error: '', unsupported: false });
            setDownloadError('');
            setSelected(item);
          }}><Eye size={18} aria-hidden="true" />Xem</button>
          {downloadButton(item)}
        </div>
      </li>;
    })}</ul>}
    {ticket.media_acknowledged_at ? <p className="repair-media-hint">Khách đã xác nhận ảnh / video mô tả chiếc máy gửi và lab kiểm tra khi nhận: {dateText(ticket.media_acknowledged_at)}{ticket.media_acknowledgment_version ? ` · Phiên bản: ${ticket.media_acknowledgment_version}` : ''}</p> : null}
    {downloadError ? <p className="repair-media-errors" role="alert">{downloadError}</p> : null}
    {selected ? <RepairMediaDialog title={selected.original_name} closeLabel="Đóng" onClose={closePreview}>
      {preview.loading ? <p role="status">Đang tải ảnh / video…</p> : null}
      {preview.error ? <div role="alert"><p>{preview.error}</p><button type="button" className="repair-media-add" onClick={() => setRetry((value) => value + 1)}><RotateCw size={18} aria-hidden="true" />Thử lại</button></div> : null}
      {preview.unsupported ? <p role="status">{unsupportedText}</p> : preview.url ? mediaKind(selected) === 'video'
        ? <video className="repair-evidence-preview" src={preview.url} controls playsInline preload="metadata" aria-label={selected.original_name} onError={() => setPreview((current) => ({ ...current, unsupported: true }))} />
        : <img className="repair-evidence-preview" src={preview.url} alt={selected.original_name} onError={() => setPreview((current) => ({ ...current, unsupported: true }))} /> : null}
      <EvidenceMetadata item={selected} />
      {downloadButton(selected)}
      {downloadError ? <p className="repair-media-errors" role="alert">{downloadError}</p> : null}
    </RepairMediaDialog> : null}
  </section>;
}
