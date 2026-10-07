import MobileCameraStockPanel from './MobileCameraStockPanel';

const formatMoney = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function SkuStockPanel({
  title,
  items,
  compact,
  onPick,
  inCartCodes,
  renderMeta,
  pickLabel,
}) {
  if (!items.length) {
    return (
      <section className="retail-mobile-camera-panel retail-mobile-camera-panel--empty">
        <p className="retail-mobile-camera-panel-title">{title}</p>
        <p className="retail-mobile-camera-panel-hint">Chưa có hàng trong kho — quét mã hoặc nhập hàng trước.</p>
      </section>
    );
  }

  const inCart = (code) => {
    if (!code || !inCartCodes) return false;
    const key = String(code).toUpperCase();
    if (inCartCodes instanceof Set) return inCartCodes.has(key);
    return inCartCodes.includes(key);
  };

  return (
    <section className={`retail-mobile-camera-panel${compact ? ' retail-mobile-camera-panel--compact' : ''}`}>
      <div className="retail-mobile-camera-panel-head">
        <p className="retail-mobile-camera-panel-title">{title}</p>
        <span className="retail-mobile-camera-panel-count">{items.length}</span>
      </div>
      <div className="retail-mobile-camera-scroll" role="list">
        {items.map((item) => {
          const picked = inCart(item.sku_code);
          return (
            <div
              key={item._id || item.sku_code}
              role="listitem"
              className={`retail-mobile-camera-row${picked ? ' retail-mobile-camera-row--in-cart' : ''}`}
            >
              <div className="retail-mobile-camera-row-main">
                <p className="retail-mobile-camera-row-name">{item.name}</p>
                <p className="retail-mobile-camera-row-serial font-mono">{item.sku_code}</p>
                {renderMeta?.(item) ? (
                  <p className="retail-mobile-camera-row-serial text-xs opacity-80">{renderMeta(item)}</p>
                ) : null}
              </div>
              <div className="retail-mobile-camera-row-side">
                <p className="retail-mobile-camera-row-price">{formatMoney(item.price)}</p>
                {picked ? (
                  <span className="retail-mobile-camera-in-cart-badge" aria-hidden="true">
                    <span className="material-symbols-outlined">check_circle</span>
                    Trong giỏ
                  </span>
                ) : (
                  onPick && (
                    <button
                      type="button"
                      className="retail-mobile-camera-add-btn"
                      onClick={() => onPick(item)}
                      aria-label={`Thêm ${item.name} vào giỏ`}
                    >
                      <span className="material-symbols-outlined">add</span>
                      Thêm
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
      {onPick && (
        <p className="retail-mobile-camera-panel-foot">Chạm “+ Thêm” để đưa {pickLabel} vào giỏ / quét mã</p>
      )}
    </section>
  );
}

/** Danh sách tồn theo danh mục — tab Bán mobile */
export default function MobileSaleStockPanel({
  group = 'camera',
  cameras = [],
  filmSkus = [],
  batteries = [],
  onPick,
  onSeed,
  compact = false,
  inCartCameraIds,
  inCartCodes,
}) {
  if (group === 'camera') {
    return (
      <MobileCameraStockPanel
        cameras={cameras}
        onSeed={onSeed}
        onPick={onPick}
        inCartCameraIds={inCartCameraIds}
        compact={compact}
      />
    );
  }

  if (group === 'film') {
    const ready = filmSkus.filter((f) => Number(f.total_quantity) > 0);
    return (
      <SkuStockPanel
        title="Film sẵn bán"
        items={ready}
        compact={compact}
        onPick={onPick}
        inCartCodes={inCartCodes}
        pickLabel="film"
        renderMeta={(item) =>
          `Còn ${Number(item.total_quantity || 0)} cuộn${
            item.nearest_expiry
              ? ` · HSD ${new Date(item.nearest_expiry).toLocaleDateString('vi-VN')}`
              : ''
          }`
        }
      />
    );
  }

  const ready = batteries.filter((b) => Number(b.quantity) > 0);
  return (
    <SkuStockPanel
      title="Pin sẵn bán"
      items={ready}
      compact={compact}
      onPick={onPick}
      inCartCodes={inCartCodes}
      pickLabel="pin"
      renderMeta={(item) =>
        `${item.battery_type || 'Pin'} · Còn ${Number(item.quantity || 0)}`
      }
    />
  );
}
