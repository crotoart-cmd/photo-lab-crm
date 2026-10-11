import AppleSegmentedControl from '../AppleSegmentedControl';
import { formatShopAdminPrice } from '../../lib/shopFx';

const SEGMENTS = [
  { id: '', label: 'Tất cả' },
  { id: 'camera', label: 'Máy' },
  { id: 'film', label: 'Film' },
  { id: 'merch', label: 'Merch' },
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

export default function ShopProductList({
  items,
  online,
  kind,
  onKind,
  webOnly,
  onToggleWebOnly,
  onOpen,
  onAdd,
  onSeedTestCameras,
}) {
  const empty = !items.length;
  const cameraEmpty = kind === 'camera' || !kind;

  return (
    <div className="shop-product-page">
      <div className="shop-product-toolbar">
        <AppleSegmentedControl items={SEGMENTS} value={kind} onChange={onKind} />
        <div className="shop-product-toolbar-actions">
          <button
            type="button"
            className={`shop-web-pill${webOnly ? ' is-on' : ''}`}
            onClick={onToggleWebOnly}
          >
            Trên web
          </button>
          <button type="button" className="apple-btn-primary btn-pill text-[13px]" onClick={onAdd}>
            Thêm
          </button>
        </div>
      </div>

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
        <div className="shop-product-list">
          {items.map((card) => (
            <button
              key={`${card.source}-${card.id}`}
              type="button"
              className="shop-product-row"
              onClick={() => onOpen(card)}
            >
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
              <span className={`shop-web-pill ${webClass(card, online)}`}>{webLabel(card, online)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
