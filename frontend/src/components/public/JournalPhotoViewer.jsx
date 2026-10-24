import { useEffect } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/counter.css';

export default function JournalPhotoViewer({ open, index, slides, onClose, copy }) {
  useEffect(() => { if (!open) return undefined; const previous = document.activeElement; return () => previous?.focus({ preventScroll: true }); }, [open]);
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return <Lightbox open={open} index={index} slides={slides} close={onClose} plugins={[Zoom, Counter]} className="journal-viewer"
    carousel={{ finite: true, preload: 1, imageFit: 'contain' }} controller={{ aria: true, closeOnBackdropClick: true }}
    animation={{ fade: reduced ? 0 : 160, swipe: reduced ? 0 : 200, zoom: reduced ? 0 : 180 }} labels={{ Close: copy.close, Next: copy.nextImage, Previous: copy.previousImage }}
    render={{ slideFooter: ({ slide }) => <div className="journal-viewer-caption"><p>{slide.description || slide.alt}</p>{slide.credit && <small>{slide.credit}</small>}</div> }} />;
}
