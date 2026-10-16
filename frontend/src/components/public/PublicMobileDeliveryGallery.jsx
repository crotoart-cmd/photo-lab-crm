import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isDeliveryImage, safeDeliveryFileUrl } from '../../lib/publicDeliveryLink';
import { usePublicLocale } from './PublicLocale';
import PublicMobileIcon from './PublicMobileIcon';
import PublicMobileBrand from './PublicMobileBrand';

const PhotoViewer = lazy(() => import('./PublicMobilePhotoViewer'));

export default function PublicMobileDeliveryGallery({ data, error, onRetry }) {
  const { t } = usePublicLocale();
  const [favorites, setFavorites] = useState(() => new Set());
  const [filter, setFilter] = useState('all');
  const [large, setLarge] = useState(false);
  const [viewer, setViewer] = useState({ ready: false, open: false, index: 0 });
  const closeViewer = useCallback(() => setViewer((state) => ({ ...state, open: false })), []);
  const files = useMemo(() => (Array.isArray(data?.files) ? data.files : []).flatMap((file) => {
    const url = safeDeliveryFileUrl(file?.url);
    return url ? [{ ...file, url }] : [];
  }), [data]);
  const images = useMemo(() => files.filter(isDeliveryImage), [files]);
  const attachments = useMemo(() => files.filter((file) => !isDeliveryImage(file)), [files]);
  const slides = useMemo(() => images.map((file, index) => ({ src: file.url, filename: file.name || file.filename, alt: `${t('exp.frame')} ${String(index + 1).padStart(2, '0')} · ${file.name || file.filename}` })), [images, t]);
  const toggleFavorite = (filename) => setFavorites((state) => {
    const next = new Set(state);
    if (next.has(filename)) next.delete(filename); else next.add(filename);
    return next;
  });
  const currentFile = images[viewer.index];
  const currentFavorite = currentFile && favorites.has(currentFile.filename);

  return (
    <main className="pm-gallery">
      <header className="pm-gallery-nav">
        <Link to="/?site=public" className="pm-icon-button" title={t('mpage.home')} aria-label={t('mpage.home')}><PublicMobileIcon name="arrow_back" /></Link>
        <PublicMobileBrand to="/?site=public" />
        <span className="pm-gallery-private"><PublicMobileIcon name="lock" /></span>
      </header>
      <div className="pm-gallery-heading">
        <p className="pm-eyebrow">{t('exp.deliveryLabel')}{data?.preview ? <span className="pm-sample">{t('exp.sample')}</span> : null}</p>
        <h1>{t('exp.yourPhotos')}</h1>
        {data ? <div className="pm-gallery-meta"><span>{data.ticketNumber}</span><span>{images.length} {t('exp.frames')}</span></div> : null}
      </div>
      {error ? <div className="pm-gallery-empty" role="alert"><PublicMobileIcon name="broken_image" /><h2>{error}</h2><button type="button" className="pm-primary" onClick={onRetry}>{t('exp.retry')}<PublicMobileIcon name="refresh" /></button></div> : !data ? <div className="pm-gallery-skeleton" aria-label={t('exp.loading')} role="status">{[1, 2, 3, 4].map((n) => <div key={n} />)}</div> : (
        <>
          <div className="pm-gallery-toolbar">
            <div className="pm-gallery-filters" role="group" aria-label={t('exp.yourPhotos')}>
              <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('exp.allFrames')}</button>
              <button type="button" aria-label={`${t('exp.favorites')} (${favorites.size})`} aria-pressed={filter === 'favorites'} onClick={() => setFilter('favorites')}><PublicMobileIcon name="favorite" />{favorites.size}</button>
            </div>
            <button type="button" className="pm-icon-button" aria-label={large ? t('exp.gridView') : t('exp.largeView')} title={large ? t('exp.gridView') : t('exp.largeView')} onClick={() => setLarge((value) => !value)}><PublicMobileIcon name={large ? 'grid_view' : 'view_agenda'} /></button>
          </div>
          <div className={`pm-gallery-grid${large ? ' pm-gallery-grid--large' : ''}`}>
            {images.map((file, index) => filter === 'favorites' && !favorites.has(file.filename) ? null : (
              <figure className="pm-frame" key={file.filename}>
                <button type="button" className="pm-frame-open" aria-label={`${t('exp.viewPhoto')} ${index + 1}`} onClick={() => setViewer({ ready: true, open: true, index })}>
                  <img src={file.url} alt={`${t('exp.frame')} ${index + 1}`} loading={index < 4 ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" />
                </button>
                <button type="button" className={`pm-frame-favorite${favorites.has(file.filename) ? ' is-on' : ''}`} aria-label={`${favorites.has(file.filename) ? t('exp.unfavorite') : t('exp.favorite')} ${index + 1}`} title={favorites.has(file.filename) ? t('exp.unfavorite') : t('exp.favorite')} aria-pressed={favorites.has(file.filename)} onClick={() => toggleFavorite(file.filename)}><PublicMobileIcon name="favorite" /></button>
                <figcaption><span>{String(index + 1).padStart(2, '0')}</span><span>{file.name || file.filename}</span></figcaption>
              </figure>
            ))}
          </div>
          {!images.length || (filter === 'favorites' && !favorites.size) ? <div className="pm-gallery-empty"><PublicMobileIcon name={images.length ? 'favorite' : 'photo_library'} /><h2>{images.length ? t('exp.emptyFavorites') : t('exp.albumEmpty')}</h2>{filter === 'favorites' ? <button type="button" className="pm-secondary" onClick={() => setFilter('all')}>{t('exp.allFrames')}</button> : null}</div> : null}
          {attachments.length ? <section className="pm-gallery-files"><h2>{t('exp.originalFiles')}</h2>{attachments.map((file) => <a key={file.filename} href={file.url} target="_blank" rel="noreferrer"><PublicMobileIcon name="description" /><span>{file.name || file.filename}</span><PublicMobileIcon name="download" /></a>)}</section> : null}
        </>
      )}
      {viewer.ready ? <Suspense fallback={<div className="pm-viewer-loading" role="status">{t('exp.loading')}</div>}><PhotoViewer open={viewer.open} index={viewer.index} slides={slides} onClose={closeViewer} onView={(index) => setViewer((state) => state.index === index ? state : { ...state, index })} download actions={[
        <button type="button" key="favorite" className={`yarl__button${currentFavorite ? ' pm-viewer-liked' : ''}`} aria-label={currentFavorite ? t('exp.unfavorite') : t('exp.favorite')} title={currentFavorite ? t('exp.unfavorite') : t('exp.favorite')} aria-pressed={!!currentFavorite} onClick={() => { if (currentFile) toggleFavorite(currentFile.filename); }}><PublicMobileIcon name="favorite" /></button>,
      ]} /></Suspense> : null}
    </main>
  );
}
