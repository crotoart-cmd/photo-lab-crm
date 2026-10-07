import { displayCameraSerial } from '../../utils/cameraStockDisplay';
import CameraStatusBadge from '../camera/CameraStatusBadge';
import { computeTrueCost, formatVnd } from '../../constants/cameraLifecycle';

const formatMoney = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

function StockRowButton({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`intake-stock-row w-full text-left ${active ? 'intake-stock-row--active' : ''} ${className}`.trim()}
    >
      {children}
    </button>
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
}) {
  if (group === 'film') {
    if (!filmRows.length) {
      return <p className="intake-stock-empty">Chưa có lô film — quét mã hoặc nhập tay phía trên.</p>;
    }
    return (
      <div className="intake-stock-list">
        {filmRows.map((r) => (
          <StockRowButton
            key={r._id}
            active={activeRowId === r._id}
            onClick={() => onSelectRow?.(r, 'film')}
          >
            <div className="intake-stock-row-head">
              <span className="intake-stock-row-code">{r.sku_code}</span>
              <span className="intake-stock-row-qty">×{r.quantity}</span>
            </div>
            <p className="intake-stock-row-name">{r.name}</p>
            <p className="intake-stock-row-meta">
              HSD {r.expiry_date ? new Date(r.expiry_date).toLocaleDateString('vi-VN') : '—'} · Bán{' '}
              {formatMoney(r.price)}
            </p>
          </StockRowButton>
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
          <StockRowButton
            key={r._id}
            active={activeRowId === r._id}
            onClick={() => onSelectRow?.(r, 'battery')}
          >
            <div className="intake-stock-row-head">
              <span className="intake-stock-row-code">{r.sku_code}</span>
              <span className="intake-stock-row-qty">×{r.quantity}</span>
            </div>
            <p className="intake-stock-row-name">{r.name}</p>
            <p className="intake-stock-row-meta">
              {r.battery_type} · Bán {formatMoney(r.price)}
            </p>
          </StockRowButton>
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
        const active = activeRowId === r._id;
        return (
          <div
            key={r._id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectRow?.(r, 'camera')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRow?.(r, 'camera');
              }
            }}
            className={`intake-stock-row w-full text-left ${active ? 'intake-stock-row--active' : ''}`}
          >
            <div className="intake-stock-row-head">
              <span className="intake-stock-row-code truncate min-w-0">{r.camera_code}</span>
              <div className="intake-stock-row-actions">
                <CameraStatusBadge status={r.status} />
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
          </div>
        );
      })}
    </div>
  );
}

function numRepair(r) {
  return Number(r?.total_repair_cost || 0);
}
