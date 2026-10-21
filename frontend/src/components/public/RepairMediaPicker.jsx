import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ImagePlus, ImageOff, Info, Play, Plus, Trash2, X } from 'lucide-react';
import Modal from '../Modal';
import { addRepairMedia, formatRepairMediaSize, REPAIR_MEDIA_ACCEPT, repairMediaKind } from '../../lib/repairMedia';
import { repairMediaT } from '../../lib/repairMediaI18n';

export function RepairMediaDialog({ title, closeLabel, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const supportsDialog = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';
  useEffect(() => {
    if (!supportsDialog) return undefined;
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [supportsDialog]);
  if (!supportsDialog) return <Modal title={title} onClose={onClose} wide>{children}</Modal>;
  return createPortal(<dialog ref={ref} className="repair-media-dialog" aria-labelledby={titleId}
    onClose={onClose}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="repair-media-dialog__body">
      <header><h3 id={titleId}>{title}</h3><button type="button" className="repair-media-icon" onClick={onClose} aria-label={closeLabel} title={closeLabel}><X size={20} /></button></header>
      {children}
    </div>
  </dialog>, document.body);
}

function FilePreview({ file, lang, onOpen, disabled = false, compact = false }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const kind = repairMediaKind(file);
  const text = (key, values) => repairMediaT(lang, key, values);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setFailed(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (failed) return <div className="repair-media-unavailable"><ImageOff size={24} aria-hidden="true" /><span>{text('unsupported')}</span></div>;
  if (!url) return compact ? <div className="repair-media-preview" aria-hidden="true" /> : null;
  if (kind === 'video') {
    const video = <video className="repair-media-preview" src={url} controls={!compact && !disabled} muted={compact} preload="metadata" playsInline onError={() => setFailed(true)} aria-label={file.name} />;
    return compact && onOpen ? <button type="button" className="repair-media-open" disabled={disabled} onClick={onOpen} aria-label={text('preview', { name: file.name })} title={text('preview', { name: file.name })}>{video}<span className="repair-media-play"><Play size={18} fill="currentColor" aria-hidden="true" /></span></button> : video;
  }
  const image = <img className="repair-media-preview" src={url} alt={file.name} onError={() => setFailed(true)} />;
  return onOpen ? <button type="button" className="repair-media-open" disabled={disabled} onClick={onOpen} aria-label={text('preview', { name: file.name })} title={text('preview', { name: file.name })}>{image}</button> : image;
}

export default function RepairMediaPicker({ files, onChange, lang = 'vi', disabled = false, review = false, compact = false }) {
  const inputRef = useRef(null);
  const id = useId();
  const [errors, setErrors] = useState([]);
  const [opened, setOpened] = useState(null);
  const text = (key, values) => repairMediaT(lang, key, values);
  const videos = files.filter((file) => repairMediaKind(file) === 'video').length;
  useEffect(() => { if (disabled) setOpened(null); }, [disabled]);
  if (compact) {
    if (review && !files.length) return null;
    return <section className="repair-media repair-media--compact" aria-labelledby={`${id}-title`}>
      <div className="repair-media-heading"><h4 id={`${id}-title`}>{text('compactTitle')}</h4><small>{files.length ? `${files.length}/6` : text('compactOptional')}</small></div>
      {!review ? <input ref={inputRef} className="repair-media-input" id={`${id}-input`} type="file" multiple accept={REPAIR_MEDIA_ACCEPT} disabled={disabled}
        aria-label={text('add')} aria-describedby={`${id}-limits`} onChange={(event) => {
          const result = addRepairMedia(files, Array.from(event.target.files || []));
          setErrors(result.errors);
          if (result.files.length !== files.length) onChange(result.files);
          event.target.value = '';
        }} /> : null}
      {!files.length ? <button type="button" className="repair-media-empty" disabled={disabled} onClick={() => inputRef.current?.click()} aria-describedby={`${id}-limits`}>
        <ImagePlus size={24} strokeWidth={1.7} aria-hidden="true" /><span><b>{text('add')}</b><small>{text('compactHint')}</small></span><Plus size={18} aria-hidden="true" />
      </button> : <ul className="repair-media-grid">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="repair-media-item">
        <FilePreview file={file} lang={lang} disabled={disabled} compact onOpen={() => setOpened(file)} />
        {!review ? <button type="button" className="repair-media-remove" disabled={disabled} aria-label={text('remove', { name: file.name })} title={text('remove', { name: file.name })} onClick={() => { setErrors([]); setOpened(null); onChange(files.filter((_, position) => position !== index)); }}><X size={16} aria-hidden="true" /></button> : null}
        <div className="repair-media-file"><span title={file.name}>{file.name}<small>{formatRepairMediaSize(file.size)}</small></span></div>
      </li>)}{!review && files.length < 6 ? <li className="repair-media-add-slot"><button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} aria-label={text('add')} title={text('add')}><Plus size={22} aria-hidden="true" /></button></li> : null}</ul>}
      <div className="repair-media-meta">
        <p className="repair-media-count" aria-live="polite">{files.length ? text('compactCount', { count: files.length, size: formatRepairMediaSize(files.reduce((sum, file) => sum + file.size, 0)) }) : null}</p>
        {!review ? <details className="repair-media-rules"><summary><Info size={14} aria-hidden="true" /><span>{text('details')}</span><ChevronDown size={14} aria-hidden="true" /></summary><div id={`${id}-limits`}><p>{text('guidance')}</p><p>{text('limits')}</p><p>{text('formats')}</p></div></details> : null}
      </div>
      {errors.length ? <ul className="repair-media-errors" role="alert">{errors.map((error, index) => <li key={index}>{error.name}: {text(`error.${error.code}`)}</li>)}</ul> : null}
      {opened ? <RepairMediaDialog title={opened.name} closeLabel={text('close')} onClose={() => setOpened(null)}><FilePreview file={opened} lang={lang} /></RepairMediaDialog> : null}
    </section>;
  }
  return <section className="repair-media" aria-labelledby={`${id}-title`}>
    <div className="repair-media-heading"><h4 id={`${id}-title`}>{text('title')}</h4>{!review ? <small>{text('optional')}</small> : null}</div>
    {!review ? <>
      <p className="repair-media-hint">{text('guidance')}</p>
      <p className="repair-media-hint" id={`${id}-limits`}>{text('limits')}<br />{text('formats')}</p>
      <input ref={inputRef} className="repair-media-input" id={`${id}-input`} type="file" multiple accept={REPAIR_MEDIA_ACCEPT} disabled={disabled}
        aria-label={text('add')} aria-describedby={`${id}-limits`} onChange={(event) => {
          const result = addRepairMedia(files, Array.from(event.target.files || []));
          setErrors(result.errors);
          if (result.files.length !== files.length) onChange(result.files);
          event.target.value = '';
        }} />
      <button type="button" className="repair-media-add" disabled={disabled || files.length >= 6} aria-describedby={`${id}-limits`} onClick={() => inputRef.current?.click()}><ImagePlus size={20} aria-hidden="true" />{text('add')}</button>
      {errors.length ? <ul className="repair-media-errors" role="alert">{errors.map((error, index) => <li key={index}>{error.name}: {text(`error.${error.code}`)}</li>)}</ul> : null}
    </> : null}
    <p className="repair-media-count" aria-live="polite">{files.length ? text('count', { count: files.length, videos, size: formatRepairMediaSize(files.reduce((sum, file) => sum + file.size, 0)) }) : text('none')}</p>
    {files.length ? <ul className="repair-media-grid">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="repair-media-item">
      <FilePreview file={file} lang={lang} disabled={disabled} onOpen={() => setOpened(file)} />
      <div className="repair-media-file"><span>{file.name}<small>{formatRepairMediaSize(file.size)}</small></span>
        {!review ? <button type="button" className="repair-media-icon" disabled={disabled} aria-label={text('remove', { name: file.name })} title={text('remove', { name: file.name })} onClick={() => { setErrors([]); setOpened(null); onChange(files.filter((_, position) => position !== index)); }}><Trash2 size={18} /></button> : null}
      </div>
    </li>)}</ul> : null}
    {opened ? <RepairMediaDialog title={opened.name} closeLabel={text('close')} onClose={() => setOpened(null)}><FilePreview file={opened} lang={lang} /></RepairMediaDialog> : null}
  </section>;
}

export function RepairMediaAcknowledgment({ files, acknowledged, onChange, disabled, lang = 'vi' }) {
  if (!files.length) return null;
  return <label className="repair-media-ack"><input name="media_acknowledged" type="checkbox" required checked={acknowledged} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span>{repairMediaT(lang, 'acknowledgment')}</span></label>;
}

export function RepairUploadStatus({ saving, hasMedia, progress, onCancel, lang = 'vi' }) {
  if (!saving) return null;
  const text = (key, values) => repairMediaT(lang, key, values);
  return <div className="repair-media-upload">
    <p role="status">{hasMedia && progress != null ? progress === 100 ? text('waiting') : text('sending', { percent: progress }) : text('preparing')}</p>
    {hasMedia ? <progress max="100" value={progress ?? undefined} aria-label={text('title')} /> : null}
    <button type="button" className="repair-media-add" onClick={onCancel}><X size={18} aria-hidden="true" />{text('cancel')}</button>
  </div>;
}
