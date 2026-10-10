import { useState } from 'react';
import { Link } from 'react-router-dom';
import PsGridFrame from '../components/public/PsGridFrame';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import { SERVICE_TILES } from '../data/publicLabServices';

const DEV_SCAN_IDS = new Set(['trang', 'toc-do', 'scan', 'in-analog']);
const FEATURED = SERVICE_TILES.filter((tile) => DEV_SCAN_IDS.has(tile.id));
const REST = SERVICE_TILES.filter((tile) => !DEV_SCAN_IDS.has(tile.id));
const PLATE_COUNT = 2;

function PagerArrow({ back }) {
  return (
    <svg viewBox="0 0 18 8" aria-hidden>
      {back ? (
        <>
          <polyline points="5.2,0.6 1.9,4 5.2,7.3" fill="none" stroke="currentColor" />
          <line x1="18" y1="4" x2="1.9" y2="4" stroke="currentColor" />
        </>
      ) : (
        <>
          <polyline points="12.8,0.6 16.1,4 12.8,7.3" fill="none" stroke="currentColor" />
          <line x1="0" y1="4" x2="16.1" y2="4" stroke="currentColor" />
        </>
      )}
    </svg>
  );
}

function ServiceTile({ tile }) {
  const { t } = usePublicLocale();
  const status = tile.enabled ? t('work.open') : t('work.soon');
  const inner = (
    <>
      <div className={`ps-tile-photo ps-tile-photo--${tile.tone}`} aria-hidden />
      <h3 className="ps-tile-title">{t(`svc.${tile.id}.title`)}</h3>
      <div className="ps-tile-fields">
        <div>
          <b>{t('work.note')}</b>
          <span>{t(`svc.${tile.id}.caption`)}</span>
        </div>
        <div>
          <b>{t('work.status')}</b>
          <span>{status}</span>
        </div>
      </div>
    </>
  );

  if (!tile.enabled) {
    return (
      <div className="ps-tile ps-tile--disabled" aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <Link to={tile.to} className="ps-tile">
      {inner}
    </Link>
  );
}

function FeaturedWork({ tile, peekTone }) {
  const { t } = usePublicLocale();
  const [plate, setPlate] = useState(0);
  const title = t(`svc.${tile.id}.title`);
  const status = tile.enabled ? t('work.open') : t('work.soon');
  const shotClass = `ps-work-shot ps-work-shot--main ps-tile-photo ps-tile-photo--${tile.tone}${plate ? ' is-alt' : ''}`;

  return (
    <article className={`ps-work${tile.enabled ? '' : ' ps-work--off'}`}>
      <div className="ps-work-copy">
        {tile.enabled ? (
          <Link to={tile.to}>
            <p className="ps-label">{t('nav.devScan')}</p>
            <h3>{title}</h3>
          </Link>
        ) : (
          <div>
            <p className="ps-label">{t('nav.devScan')}</p>
            <h3>{title}</h3>
          </div>
        )}
        <div className="ps-work-foot">
          <div className="ps-work-meta">
            <div>
              <b className="ps-label">{t('work.note')}</b>
              <span>{t(`svc.${tile.id}.caption`)}</span>
            </div>
            <div>
              <b className="ps-label">{t('work.status')}</b>
              <span>{status}</span>
            </div>
          </div>
          <div className="ps-work-pager">
            <p className="ps-label">
              {t('work.image')} {plate + 1}/{PLATE_COUNT}
            </p>
            <div className="ps-pager-btns">
              <button
                type="button"
                className="ps-pager-btn"
                aria-label={t('work.prev')}
                disabled={plate === 0}
                onClick={() => setPlate((p) => Math.max(0, p - 1))}
              >
                <PagerArrow back />
              </button>
              <button
                type="button"
                className="ps-pager-btn"
                aria-label={t('work.next')}
                disabled={plate === PLATE_COUNT - 1}
                onClick={() => setPlate((p) => Math.min(PLATE_COUNT - 1, p + 1))}
              >
                <PagerArrow />
              </button>
            </div>
          </div>
        </div>
      </div>
      {tile.enabled ? (
        <Link to={tile.to} className={shotClass} aria-label={title} />
      ) : (
        <div className={shotClass} aria-hidden />
      )}
      {peekTone ? (
        <div className={`ps-work-shot ps-work-shot--peek ps-tile-photo ps-tile-photo--${peekTone}`} aria-hidden />
      ) : null}
    </article>
  );
}

export default function PublicHome() {
  const { t } = usePublicLocale();
  return (
    <PsPage>
      <section className="ps-hero ps-grid">
        <PsGridFrame tone="intro" />
        <h1>
          {t('home.h1a')}
          <br />
          {t('home.h1b')}
        </h1>
        <p className="ps-lede">{t('home.lede')}</p>
        <div className="ps-specs">
          <span>{t('home.spec1')}</span>
          <span>{t('home.spec2')}</span>
          <span>{t('home.spec3')}</span>
        </div>
        <div className="ps-hero-actions">
          <Link to="/film" className="ps-cta ps-cta--fill">
            {t('cta.sendRoll')}
          </Link>
          <Link to="/sua-may" className="ps-cta">
            {t('cta.repair')}
          </Link>
        </div>
      </section>

      <section className="ps-lab-block ps-grid">
        <PsGridFrame tone="band" />
        <h2 className="ps-lab-heading">{t('home.services')}</h2>
        <div className="ps-lab-side">
          <p className="ps-lab-intro">{t('home.intro')}</p>
          <a href="#them" className="ps-cta">
            {t('cta.allServices')}
          </a>
        </div>
        <div className="ps-works">
          {FEATURED.map((tile, i) => (
            <FeaturedWork
              key={tile.id}
              tile={tile}
              peekTone={(FEATURED[i + 1] || REST[0] || {}).tone}
            />
          ))}
        </div>
        <div id="them" className="ps-tiles">
          {REST.map((tile) => (
            <ServiceTile key={tile.id} tile={tile} />
          ))}
        </div>
      </section>
    </PsPage>
  );
}
