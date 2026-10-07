import { displayCameraSerial } from '../../utils/cameraStockDisplay';

const formatMoney = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

/**
 * Danh sách máy sẵn bán — luôn hiện trên mobile (Bán hàng / Nhập hàng).
 * @param {Set<string>|string[]} [inCartCameraIds] — máy đã có trong giỏ (highlight)
 */
export default function MobileCameraStockPanel({
  cameras = [],
  onSeed,
  onPick,
  compact = false,
  inCartCameraIds,
}) {
  const inCart = (id) => {
    if (!id || !inCartCameraIds) return false;
    if (inCartCameraIds instanceof Set) return inCartCameraIds.has(id);
    return inCartCameraIds.includes(id);
  };
  const ready = cameras.filter((c) => c.status === 'San_Hang');

  if (ready.length === 0) {
    return (
      <section className="retail-mobile-camera-panel retail-mobile-camera-panel--empty">
        <p className="retail-mobile-camera-panel-title">Chưa có máy ảnh trong kho</p>
        <p className="retail-mobile-camera-panel-hint">
          Nạp 10 máy film mẫu (serial <strong>TEST-*</strong>) và đơn bán demo để thử quét, bán và
          xem biểu đồ.
        </p>
        {onSeed && (
          <button type="button" className="retail-mobile-camera-seed-btn" onClick={onSeed}>
            Nạp dữ liệu test (máy + đơn bán)
          </button>
        )}
      </section>
    );
  }

  return (
    <section className={`retail-mobile-camera-panel${compact ? ' retail-mobile-camera-panel--compact' : ''}`}>
      <div className="retail-mobile-camera-panel-head">
        <p className="retail-mobile-camera-panel-title">Máy sẵn bán</p>
        <span className="retail-mobile-camera-panel-count">{ready.length}</span>
      </div>
      <div className="retail-mobile-camera-scroll" role="list">
        {ready.map((cam) => {
          const picked = inCart(cam._id);
          return (
          <div
            key={cam._id}
            role="listitem"
            className={`retail-mobile-camera-row${picked ? ' retail-mobile-camera-row--in-cart' : ''}`}
          >
            <div className="retail-mobile-camera-row-main">
              <p className="retail-mobile-camera-row-name">{cam.model_name}</p>
              <p className="retail-mobile-camera-row-serial font-mono">{cam.camera_code}</p>
              {displayCameraSerial(cam) ? (
                <p className="retail-mobile-camera-row-serial text-xs opacity-80">
                  SN {displayCameraSerial(cam)}
                </p>
              ) : null}
            </div>
            <div className="retail-mobile-camera-row-side">
              <p className="retail-mobile-camera-row-price">{formatMoney(cam.price)}</p>
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
                    onClick={() => onPick(cam)}
                    aria-label={`Thêm ${cam.model_name} vào giỏ`}
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
        <p className="retail-mobile-camera-panel-foot">Chạm “+ Thêm” để đưa máy vào giỏ / quét mã</p>
      )}
    </section>
  );
}
