import { useEffect, useMemo, useRef, useState } from 'react';
import AppleSegmentedControl from '../AppleSegmentedControl';
import { formatShopAdminPrice, formatVndExact } from '../../lib/shopFx';
import { shopKey } from '../../lib/shopCatalog';

const SEGMENTS = [
  { id: '', label: 'Tất cả' },
  { id: 'camera', label: 'Máy' },
  { id: 'film', label: 'Film' },
  { id: 'merch', label: 'Merch' },
];

const VIEW_KEY = 'hdtlabx.kho.view';
const VIEWS = [
  { id: 'list', label: 'Danh sách' },
  { id: 'grid', label: 'Lưới' },
  { id: 'gallery', label: 'Thẻ lớn' },
];

function webLabel(card, online) {
  if (!online && !card.showOnWeb) return 'Chưa đồng bộ';
  if (card.reserved > 0 || card.skuReserved > 0) return `Giữ ${card.reserved || card.skuReserved}`;
  return card.showOnWeb ? 'Web' : 'Ẩn';
}

function webClass(card, online) {
  if (!online && !card.showOnWeb) return 'is-off';
  if (card.reserved > 0 || card.skuReserved > 0) return 'is-held';
  return card.showOnWeb ? 'is-on' : '';
}

function metaOf(card) {
  const bits = [formatShopAdminPrice(card.price)];
  if (card.source === 'camera' && card.serial) bits.push(`SN ${card.serial}`);
  else bits.push(`còn ${card.quantity ?? 0}`);
  if (card.kind) bits.push(card.kind);
  return bits.join(' · ');
}

function kindLabel(card) {
  if (card.source === 'camera') return 'Máy ảnh';
  if (card.source === 'film') return 'Film';
  if (card.source === 'battery') return 'Pin';
  return card.kind || 'Merch';
}

function stockOf(card) {
  if (card.source === 'camera' && card.serial) return card.serial;
  return String(card.quantity ?? 0);
}

function readView() {
  try {
    const v = sessionStorage.getItem(VIEW_KEY);
    if (v === 'grid' || v === 'gallery' || v === 'list') return v;
  } catch {
    /* ignore */
  }
  return 'list';
}

function ViewIcon({ id }) {
  if (id === 'grid') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (id === 'gallery') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="1.5" y="3.25" width="13" height="9.5" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function ShopProductList({
  items,
  online,
  kind,
  onKind,
  webOnly,
  onToggleWebOnly,
  onOpen,
  selected,
  detail,
  onAdd,
  onSeedTestCameras,
  onBulkWeb,
}) {
  const empty = !items.length;
  const cameraEmpty = kind === 'camera' || !kind;
  const selectedKey = selected ? shopKey(selected.source, selected.id) : '';
  const [view, setView] = useState(readView);
  const [checked, setChecked] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const lastIndexRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  useEffect(() => {
    setChecked(new Set());
    lastIndexRef.current = null;
  }, [kind, webOnly]);

  const visibleKeys = useMemo(() => items.map((card) => shopKey(card.source, card.id)), [items]);
  const allChecked = visibleKeys.length > 0 && visibleKeys.every((key) => checked.has(key));
  const picked = useMemo(() => items.filter((card) => checked.has(shopKey(card.source, card.id))), [items, checked]);

  const selectRange = (toIndex) => {
    if (toIndex < 0) return;
    const from = lastIndexRef.current;
    if (from == null) {
      lastIndexRef.current = toIndex;
      setChecked(new Set([visibleKeys[toIndex]]));
      return;
    }
    const start = Math.min(from, toIndex);
    const end = Math.max(from, toIndex);
    setChecked((cur) => {
      const next = new Set(cur);
      for (let i = start; i <= end; i += 1) next.add(visibleKeys[i]);
      return next;
    });
  };

  const toggleOne = (key) => {
    const index = visibleKeys.indexOf(key);
    lastIndexRef.current = index < 0 ? lastIndexRef.current : index;
    setChecked((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggle = (key, e) => {
    e.stopPropagation();
    if (e.nativeEvent?.shiftKey || e.shiftKey) {
      e.preventDefault();
      selectRange(visibleKeys.indexOf(key));
      return;
    }
    toggleOne(key);
  };

  const toggleAll = (e) => {
    e.stopPropagation();
    setChecked(allChecked ? new Set() : new Set(visibleKeys));
    lastIndexRef.current = allChecked ? null : 0;
  };

  const bulkWeb = async (show) => {
    if (!picked.length || !onBulkWeb || bulkBusy) return;
    setBulkBusy(true);
    try {
      await onBulkWeb(picked, show);
      setChecked(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  const renderCheck = (key, extra = {}) => (
    <input
      type="checkbox"
      className="shop-check"
      checked={checked.has(key)}
      onClick={(e) => {
        e.stopPropagation();
        if (!e.shiftKey) return;
        e.preventDefault();
        selectRange(visibleKeys.indexOf(key));
      }}
      onChange={(e) => {
        if (e.nativeEvent.shiftKey) return;
        toggle(key, e);
      }}
      {...extra}
    />
  );

  const renderCard = (card) => {
    const key = shopKey(card.source, card.id);
    const active = key === selectedKey;
    return (
      <div
        key={key}
        role="option"
        tabIndex={0}
        aria-selected={active}
        className={`shop-product-row${active ? ' is-selected' : ''}${checked.has(key) ? ' is-checked' : ''}`}
        onClick={(e) => {
          if (e.shiftKey) {
            e.preventDefault();
            selectRange(visibleKeys.indexOf(key));
            return;
          }
          onOpen(card);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen(card);
          }
        }}
      >
        {renderCheck(key, { 'aria-label': `Chọn ${card.title}` })}
        <span className="shop-product-name">
          {card.image ? (
            <img src={card.image} alt="" className="shop-product-thumb" />
          ) : (
            <span className="shop-product-thumb is-empty" aria-hidden="true" />
          )}
          <span className="shop-product-copy">
            {card.brand ? <span className="shop-product-brand">{card.brand}</span> : null}
            <span className="shop-product-title">{card.title}</span>
            <span className="shop-product-meta">{metaOf(card)}</span>
          </span>
        </span>
        <span className="shop-product-cell">{formatVndExact(card.price)}</span>
        <span className="shop-product-cell">{kindLabel(card)}</span>
        <span className="shop-product-cell shop-product-cell--stock">{stockOf(card)}</span>
        <span className={`shop-web-status ${webClass(card, online)}`}>{webLabel(card, online)}</span>
      </div>
    );
  };

  return (
    <div className={`shop-product-page${selected ? ' is-open' : ''} is-${view}`}>
      <div className="shop-desk-frame">
        <div className="shop-product-toolbar">
          <AppleSegmentedControl items={SEGMENTS} value={kind} onChange={onKind} />
          <div className="shop-product-toolbar-actions">
            <div className="shop-view-switch" role="group" aria-label="Bố cục xem">
              {VIEWS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={view === item.id}
                  className={view === item.id ? 'is-on' : ''}
                  onClick={() => setView(item.id)}
                >
                  <ViewIcon id={item.id} />
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-pressed={webOnly}
              className={`btn-pill btn-pill--36 ${webOnly ? 'btn-pill--lv2' : 'btn-pill--lv4'}`}
              onClick={onToggleWebOnly}
            >
              Trên web
            </button>
            <button type="button" className="btn-pill btn-pill--36 btn-pill--lv1" onClick={onAdd}>
              Thêm
            </button>
          </div>
        </div>
        <div className="shop-product-workspace">
          <div className="shop-product-master">
            {empty ? (
              <div className="shop-product-empty">
                <p>Chưa có sản phẩm{webOnly ? ' trên web' : ' trong kho'}.</p>
                {cameraEmpty && !webOnly && onSeedTestCameras ? (
                  <button type="button" className="retail-mobile-camera-seed-btn" onClick={onSeedTestCameras}>
                    Nạp dữ liệu test
                  </button>
                ) : null}
              </div>
            ) : (
              <div className={`shop-product-list is-${view}`} role="listbox" aria-label="Sản phẩm kho" aria-multiselectable>
                {view === 'list' ? (
                  <div className="shop-product-head">
                    <input
                      type="checkbox"
                      className="shop-check"
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="Chọn tất cả"
                    />
                    <span>Tên</span>
                    <span>Giá</span>
                    <span>Loại</span>
                    <span>Tồn</span>
                    <span>Web</span>
                  </div>
                ) : null}
                {items.map(renderCard)}
              </div>
            )}
          </div>

          <aside className="shop-product-detail" aria-live="polite">
            {detail}
          </aside>
        </div>
        {picked.length ? (
          <div className="shop-bulk-bar" role="toolbar" aria-label="Thao tác đã chọn">
            <span className="shop-bulk-count">{picked.length} đã chọn</span>
            <button
              type="button"
              className="btn-pill btn-pill--36 btn-pill--lv2"
              disabled={!online || bulkBusy}
              onClick={() => bulkWeb(true)}
            >
              {bulkBusy ? 'Đang lưu…' : 'Hiện Shop'}
            </button>
            <button
              type="button"
              className="btn-pill btn-pill--36 btn-pill--lv4"
              disabled={!online || bulkBusy}
              onClick={() => bulkWeb(false)}
            >
              Ẩn Shop
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
