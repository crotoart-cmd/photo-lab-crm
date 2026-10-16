import { useEffect, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Download from 'yet-another-react-lightbox/plugins/download';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';
import { usePublicLocale } from './PublicLocale';

const VIEW_PLUGINS = [Zoom, Counter];
const DOWNLOAD_PLUGINS = [Zoom, Counter, Download];

export default function PublicMobilePhotoViewer({ open, slides, index, onClose, onView, download = false, actions = [] }) {
  const { t } = usePublicLocale();
  const [downloadError, setDownloadError] = useState(false);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!open) return undefined;
    setDownloadError(false);
    const previous = document.activeElement;
    const media = window.matchMedia('(max-width: 767px)');
    const onResize = () => { if (!media.matches) onClose(); };
    media.addEventListener('change', onResize);
    return () => {
      media.removeEventListener('change', onResize);
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  return <Lightbox
    className="pm-viewer"
    open={open}
    close={onClose}
    slides={slides}
    index={index}
    plugins={download ? DOWNLOAD_PLUGINS : VIEW_PLUGINS}
    toolbar={{ buttons: [...actions, 'zoom', ...(download ? ['download'] : []), 'close'] }}
    carousel={{ finite: true, preload: 1, imageFit: 'contain' }}
    controller={{ aria: true, closeOnPullDown: true, closeOnBackdropClick: true }}
    animation={{ fade: reduce ? 0 : 180, swipe: reduce ? 0 : 260, zoom: reduce ? 0 : 200 }}
    labels={{ Close: t('mpage.close'), Next: t('exp.nextPhoto'), Previous: t('exp.prevPhoto'), 'Zoom in': t('exp.zoomIn'), 'Zoom out': t('exp.zoomOut'), Download: t('exp.download') }}
    on={{ view: ({ index: next }) => { setDownloadError(false); onView?.(next); } }}
    download={{ download: async ({ slide, saveAs }) => {
      try {
        const response = await fetch(slide.src, { cache: 'no-store', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error('download');
        saveAs(await response.blob(), slide.filename || 'HDTLabx.jpg');
      } catch { setDownloadError(true); }
    } }}
    render={{ slideFooter: ({ slide }) => <div className="pm-viewer-caption"><span>{slide.alt}</span>{downloadError ? <span role="alert">{t('exp.downloadError')}</span> : null}</div> }}
  />;
}
