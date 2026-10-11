import { useEffect, useMemo, useState } from 'react';
import { usePublicLocale } from '../components/public/PublicLocale';
import PsPage from '../components/public/PsPage';
import PsPhoto from '../components/public/PsPhoto';
import PublicShopOrderSheet from '../components/public/PublicShopOrderSheet';
import publicApi from '../api/publicClient';
import { loadPublicContent } from '../lib/publicContent';
import { formatShopPublicPrice } from '../lib/shopFx';

const FALLBACK_TONES = ['film', 'speed', 'print', 'scan'];
const KINDS = [
  { id: '', key: 'acc.all' },
  { id: 'camera', key: 'acc.kindCamera' },
  { id: 'film', key: 'acc.kindFilm' },
  { id: 'battery', key: 'acc.kindBattery' },
  { id: 'merch', key: 'acc.kindMerch' },
];
const KIND_I18N = {
  camera: 'acc.kindCamera',
  film: 'acc.kindFilm',
  battery: 'acc.kindBattery',
  merch: 'acc.kindMerch',
};

function catalogKindLabel(row, t) {
  const key = KIND_I18N[row.source];
  if (key) return t(key);
  if (row.kind === 'Máy ảnh') return t('acc.kindCamera');
  if (row.kind === 'Pin') return t('acc.kindBattery');
  return row.kind || '';
}

function galleryOf(row) {
  const list = [];
  for (const src of [row.image, ...(row.images || [])]) {
    if (src && !list.includes(src)) list.push(src);
  }
  return list;
}

export default function PublicAccessories() {
  const { t } = usePublicLocale();
  const [kind, setKind] = useState('');
  const [brand, setBrand] = useState('');
  const [shop, setShop] = useState([]);
  const [buying, setBuying] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      publicApi.get('/public/shop').then(({ data }) => data?.items || []).catch(() => []),
      loadPublicContent().then((data) => data.accessories || []),
    ]).then(([stock, merch]) => {
      if (cancelled) return;
      setShop(
        stock.length
          ? stock.map((row) => ({ ...row, images: galleryOf(row), orderable: true }))
          : merch.map((row) => ({
              source: 'merch',
              id: row.id,
              brand: row.kind || '',
              title: row.title,
              price: row.price || 0,
              available: Number(row.quantity || 0) > 0,
              image: row.image,
              images: galleryOf(row),
              description: row.excerpt || '',
              showOnWeb: true,
            }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const brands = useMemo(
    () => [...new Set(shop.map((row) => row.brand).filter(Boolean))],
    [shop]
  );
  const items = shop.filter((row) => {
    if (kind && row.source !== kind) return false;
    if (brand && row.brand !== brand) return false;
    return true;
  });

  return (
    <PsPage>
      <section className="ps-catalog ps-grid">
        <aside className="ps-catalog-side">
          <h1>{t('acc.h1')}</h1>
          <p className="ps-lede">{t('acc.lede')}</p>
          <div className="ps-filters">
            <details className="ps-filter" open>
              <summary>{t('acc.filter')}</summary>
              <div className="ps-filter-opts">
                {KINDS.map((item) => (
                  <button
                    key={item.id || 'all'}
                    type="button"
                    className={kind === item.id ? 'is-on' : undefined}
                    onClick={() => setKind(item.id)}
                  >
                    {t(item.key)}
                  </button>
                ))}
              </div>
            </details>
            {brands.length ? (
              <details className="ps-filter">
                <summary>{t('acc.brand')}</summary>
                <div className="ps-filter-opts">
                  <button
                    type="button"
                    className={!brand ? 'is-on' : undefined}
                    onClick={() => setBrand('')}
                  >
                    {t('acc.allBrands')}
                  </button>
                  {brands.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={brand === name ? 'is-on' : undefined}
                      onClick={() => setBrand(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </details>
            ) : null}
            {kind || brand ? (
              <button
                type="button"
                className="ps-filter-clear"
                onClick={() => {
                  setKind('');
                  setBrand('');
                }}
              >
                {t('acc.clear')}
              </button>
            ) : null}
          </div>
        </aside>

        <div className="ps-catalog-list">
          {items.map((row, i) => {
            const kindLabel = catalogKindLabel(row, t);
            return (
            <button
              key={`${row.source}-${row.id}`}
              type="button"
              className={`ps-acc-item${row.available ? '' : ' is-out'}`}
              onClick={() => setBuying(row)}
            >
              <PsPhoto
                src={row.image}
                tone={FALLBACK_TONES[i % FALLBACK_TONES.length]}
                className="ps-acc-thumb"
                alt={row.title}
              />
              <div className="ps-acc-copy">
                {row.brand ? <p className="ps-shop-brand">{row.brand}</p> : null}
                <h2>{row.title}</h2>
                <p className="ps-acc-spec">
                  {row.available ? formatShopPublicPrice(row.price) : t('acc.sold')}
                  {kindLabel ? ` · ${kindLabel}` : ''}
                </p>
              </div>
            </button>
            );
          })}
        </div>
      </section>

      {buying ? (
        <PublicShopOrderSheet
          item={buying}
          priceLabel={formatShopPublicPrice(buying.price)}
          onClose={() => setBuying(null)}
          onOrdered={() => setReloadKey((k) => k + 1)}
        />
      ) : null}
    </PsPage>
  );
}
