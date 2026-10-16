import { useState } from 'react';
import PsPhoto from './PsPhoto';
import { usePublicLocale } from './PublicLocale';
import { PublicMobilePage, PublicMobileTitle } from './PublicMobilePage';
import PublicMobileIcon from './PublicMobileIcon';

export default function PublicMobileShop({ kinds, kind, setKind, items, onBuy, kindLabel, empty, priceOf }) {
  const { t } = usePublicLocale();
  const [query, setQuery] = useState('');
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const search = normalize(query.trim());
  const filtered = items.filter((row) => normalize(`${row.brand || ''} ${row.title} ${kindLabel(row)}`).includes(search));
  return (
    <PublicMobilePage>
      <PublicMobileTitle title={t('mpage.shop')} spec={t('acc.lede')} />
      <div className="ps-msearch" role="search">
        <label className="sr-only" htmlFor="mobile-shop-search">{t('mpage.search')}</label>
        <input id="mobile-shop-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('mpage.search')} autoComplete="off" />
        {query ? <button type="button" className="ps-micon-button" aria-label={t('mpage.clearSearch')} title={t('mpage.clearSearch')} onClick={() => { setQuery(''); document.getElementById('mobile-shop-search')?.focus(); }}><PublicMobileIcon name="close" /></button> : null}
      </div>
      <div className="ps-mchips ps-mchips--scroll" role="group" aria-label={t('acc.filter')}>
        {kinds.map((item) => (
          <button
            key={item.id || 'all'}
            type="button"
            className={kind === item.id ? 'is-on' : undefined}
            aria-pressed={kind === item.id}
            onClick={() => setKind(item.id)}
          >
            {t(item.key)}
          </button>
        ))}
      </div>
      <p className="ps-mresult-count" role="status">{filtered.length} {t('mpage.products')}</p>
      {filtered.length ? (
        <section className="ps-mpro-group ps-mcatalog" aria-label={t('mpage.shop')}>
          {filtered.map((row, i) => {
            const label = kindLabel(row);
            return (
              <button
                key={`${row.source}-${row.id}`}
                type="button"
                className={`ps-mshop${row.available ? '' : ' is-out'}`}
                onClick={() => onBuy(row)}
              >
                <PsPhoto
                  src={row.image}
                  tone={['film', 'speed', 'print', 'scan'][i % 4]}
                  className="ps-mshop-thumb"
                  alt=""
                />
                <span>
                  {row.brand ? <i>{row.brand}</i> : null}
                  <b>{row.title}</b>
                  <i>
                    {row.available ? priceOf(row) : t('acc.sold')}
                    {label ? ` · ${label}` : ''}
                  </i>
                </span>
                <PublicMobileIcon name="chevron_right" />
              </button>
            );
          })}
        </section>
      ) : (
        <div className="ps-mempty">
          <h2>{search || kind ? t('mpage.noResults') : t('mpage.emptyShop')}</h2>
          {search || kind ? <button type="button" className="ps-mcta" onClick={() => { setQuery(''); setKind(''); }}>{t('mpage.resetFilters')}</button> : <p>{empty}</p>}
        </div>
      )}
    </PublicMobilePage>
  );
}
