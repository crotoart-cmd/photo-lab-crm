import { displayCameraSerial } from '../../utils/cameraStockDisplay';
import CameraStatusBadge from '../camera/CameraStatusBadge';
import { computeTrueCost, formatVnd } from '../../constants/cameraLifecycle';
import { shopKey } from '../../lib/shopCatalog';
import { WebPill } from './ShopListingSheet';

const formatMoney = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function StockRow({ active, onClick, children }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`intake-stock-row w-full text-left ${active ? 'intake-stock-row--active' : ''}`}
    >
      {children}
    </div>
  );
}

export default function IntakeStockList({
  group,
  filmRows = [],
  batteryRows = [],
  cameraRows = [],
  activeRowId,
  onSelectRow,
  onOpenCameraDetail,
  onSeedTestCameras,
  web,
  onOpenWeb,
}) {
  const pill = (source, id) =>
    web ? <WebPill card={web.byKey.get(shopKey(source, id))} online={web.online} onOpen={onOpenWeb} /> : null;

  if (group === 'film') {
    if (!filmRows.length) {
      return <p className="intake-stock-empty">Chưa có lô film — quét mã hoặc nhập tay phía trên.</p>;
    }
    return (
      <div className="intake-stock-list">
        {filmRows.map((r) => (
          <StockRow key={r._id} active={activeRowId === r._id} onClick={() => onSelectRow?.(r, 'film')}>
            <div className="intake-stock-row-head">
              <span className="intake-stock-row-code">{r.sku_code}</span>
              <div className="intake-stock-row-actions">
                <span className="intake-stock-row-qty">×{r.quantity}</span>
                {pill('film', r._id)}
              </div>
            </div>
            <p className="intake-stock-row-name">{r.name}</p>
            <p className="intake-stock-row-meta">
              HSD {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('vi-VN') : '—'} · còn{' '}
              {Number(r.quantity || 0)} / nhập {Number(r.receivedQty || r.quantity || 0)}
            </p>
          </StockRow>
        ))}
      </div>
    );
  }

  if (group === 'battery') {
    if (!batteryRows.length) {
      return <p className="intake-stock-empty">Chưa có SKU pin trong kho.</p>;
    }
    return (
      <div className="intake-stock-list">
        {batteryRows.map((r) => (
          <StockRow key={r._id} active={activeRowId === r._id} onClick={() => onSelectRow?.(r, 'battery')}>
            <div className="intake-stock-row-head">
              <span className="intake-stock-row-code">{r.sku_code}</span>
              <div className="intake-stock-row-actions">
                <span className="intake-stock-row-qty">×{r.quantity}</span>
                {pill('battery', r._id)}
              </div>
            </div>
            <p className="intake-stock-row-name">{r.name}</p>
            <p className="intake-stock-row-meta">
              {r.battery_type} · Bán {formatMoney(r.price)}
            </p>
          </StockRow>
        ))}
      </div>
    );
  }

  const rows = cameraRows.filter((r) => r.status !== 'Da_Ban');
  if (!rows.length) {
    return (
      <div className="intake-stock-empty-block">
        <p className="intake-stock-empty">Chưa có máy trong kho — nhập serial mới phía trên.</p>
        {onSeedTestCameras && (
          <>
            <p className="retail-mobile-camera-panel-hint">
              Hoặc nạp 10 máy film mẫu (serial <strong>TEST-*</strong>) và đơn bán demo.
            </p>
            <button type="button" className="retail-mobile-camera-seed-btn" onClick={onSeedTestCameras}>
              Nạp dữ liệu test (máy + đơn bán)
            </button>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="intake-stock-list">
      {rows.map((r) => {
        const trueCost = computeTrueCost(r);
        return (
          <StockRow key={r._id} active={activeRowId === r._id} onClick={() => onSelectRow?.(r, 'camera')}>
            <div className="intake-stock-row-head">
              <span className="intake-stock-row-code truncate min-w-0">{r.camera_code}</span>
              <div className="intake-stock-row-actions">
                <CameraStatusBadge status={r.status} />
                {pill('camera', r._id)}
                {onOpenCameraDetail && (
                  <button
                    type="button"
                    className="intake-stock-profile-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenCameraDetail(r);
                    }}
                  >
                    Hồ sơ
                  </button>
                )}
              </div>
            </div>
            <p className="intake-stock-row-name">{r.model_name}</p>
            <p className="intake-stock-row-meta font-mono text-xs">
              {displayCameraSerial(r) ? `SN ${displayCameraSerial(r)}` : 'Không có sê-ri gốc'}
            </p>
            <p className="intake-stock-row-meta">
              Vốn thực {formatVnd(trueCost)}
              {numRepair(r) > 0 ? ` · Sửa ${formatVnd(r.total_repair_cost)}` : ''}
              {' · '}Bán {formatMoney(r.price)}
            </p>
            {r.condition_note && (
              <p className="intake-stock-row-meta text-[var(--color-orange)] truncate">{r.condition_note}</p>
            )}
          </StockRow>
        );
      })}
    </div>
  );
}

function numRepair(r) {
  return Number(r?.total_repair_cost || 0);
}
