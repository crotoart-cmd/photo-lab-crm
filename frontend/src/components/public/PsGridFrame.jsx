import { useEffect, useRef } from 'react';

export default function PsGridFrame({ tone = 'band', className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.classList.add('is-on');
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add('is-on');
        io.disconnect();
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const introVerts = (
    <div className="ps-frame-cols">
      <span className="ps-vline" />
      <span className="ps-vline" />
      <span className="ps-vline" />
      <span className="ps-vline" />
      <span className="ps-vline" />
      <span className="ps-vline" />
    </div>
  );

  const footerVerts = (
    <div className="ps-frame-cols ps-frame-cols--split">
      <span className="ps-vline" />
      <span className="ps-vline" />
      <span className="ps-vline" />
    </div>
  );

  return (
    <div ref={ref} className={`ps-frame ps-frame--${tone} ${className}`.trim()} aria-hidden="true">
      {tone === 'intro' ? <span className="ps-hline ps-hline--top" /> : null}
      {tone === 'band' || tone === 'footer' ? <span className="ps-hline ps-hline--top" /> : null}
      {tone === 'intro' ? introVerts : null}
      {tone === 'footer' ? footerVerts : null}
      {tone === 'intro' ? <span className="ps-hline ps-hline--bottom" /> : null}
    </div>
  );
}
