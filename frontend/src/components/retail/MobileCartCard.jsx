import { inputClass } from '../formFields';
import { formatOfferInput, parseOfferInput, fmtMoney, fmtMoneyDisplay, isMoneyCompact } from '../../utils/retailPricing';
import { displayCameraSerial } from '../../utils/cameraStockDisplay';

const fmt = (n) => fmtMoneyDisplay(n);
const moneyTitle = (n) => (isMoneyCompact(n) ? fmtMoney(n) : undefined);
const num = (v, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};

function cartItemMeta(item) {
  if (item.product_group === 'camera') {
    const serial = displayCameraSerial(item);
    return serial ? `SN ${serial}` : item.code;
  }
  return item.code;
}

/** Giỏ hàng — layout dọc, vùng chạm lớn (iPhone) */
export default function MobileCartCard({ item, onChange, onRemove }) {
  const offerRaw = item.offer_price;
  const offer = offerRaw === '' ? '' : num(offerRaw, item.list_price);
  const offerNum = offer === '' ? 0 : num(offer);
  const belowFloor = item.floor_price > 0 && offerNum > 0 && offerNum < item.floor_price;
  const profitUnit = offerNum - item.cost;
  const totalLine = offerNum * item.qty;

  const offerStored = offerRaw === '' ? '' : offerRaw ?? item.list_price;
  const offerDisplay = offerStored === '' ? '' : formatOfferInput(offerStored);
  const offerDigitLen = String(offerStored).replace(/\D/g, '').length;

  const stopTouch = (e) => e.stopPropagation();

  return (
    <div
      className={`retail-cart-card rounded-2xl border ${
        belowFloor ? 'border-red-400 bg-red-50' : 'border-[var(--color-separator)] bg-[var(--color-bg-elevated)]'
      }`}
    >
      <div className="retail-cart-card-head">
        <div className="min-w-0 flex-1">
          <p className="retail-cart-card-name">{item.name}</p>
          <p className="retail-cart-card-meta">{cartItemMeta(item)}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item._cid)}
          className="retail-touch-btn retail-cart-card-remove"
          aria-label="Xóa"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="retail-cart-ref">
        <div className="retail-cart-ref-item">
          <span className="retail-cart-ref-label">Nhập</span>
          <span className="retail-cart-ref-value" title={moneyTitle(item.cost)}>{fmt(item.cost)}</span>
        </div>
        <div className="retail-cart-ref-item">
          <span className="retail-cart-ref-label">Niêm yết</span>
          <span className="retail-cart-ref-value retail-cart-ref-value--list" title={moneyTitle(item.list_price)}>
            {fmt(item.list_price)}
          </span>
        </div>
        <div className="retail-cart-ref-item">
          <span className="retail-cart-ref-label">Sàn</span>
          <span className="retail-cart-ref-value retail-cart-ref-value--floor" title={moneyTitle(item.floor_price)}>
            {fmt(item.floor_price)}
          </span>
        </div>
      </div>

      {item.product_group !== 'camera' && (
        <label className="retail-cart-qty" onTouchStart={stopTouch}>
          <span className="retail-cart-qty-label">SL</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={item.stock_qty || 999}
            value={item.qty}
            onChange={(e) => onChange(item._cid, 'qty', Math.max(1, num(e.target.value, 1)))}
            className={`${inputClass} retail-cart-qty-input ios-input`}
          />
        </label>
      )}

      <div className="retail-cart-deal">
        <div className="retail-cart-offer-col">
          <span className="retail-cart-deal-label">Offer</span>
          <label className="retail-cart-offer-field" onTouchStart={stopTouch}>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={item.list_price ? formatOfferInput(item.list_price) : ''}
              value={offerDisplay}
              onChange={(e) => onChange(item._cid, 'offer_price', parseOfferInput(e.target.value))}
              className={`${inputClass} retail-cart-offer-input ios-input${
                offerDigitLen > 9 ? ' retail-cart-offer-input--compact' : ''
              } ${belowFloor ? 'retail-cart-offer-input--warn' : ''}`}
            />
          </label>
        </div>

        <div className="retail-cart-outcome-col">
          <span className="retail-cart-deal-label">Bán ra</span>
          <div className="retail-cart-outcome-body">
            <span
              className={`retail-cart-outcome-total${belowFloor ? ' retail-cart-outcome-total--warn' : ''}`}
              title={moneyTitle(totalLine)}
            >
              {fmt(totalLine)}
            </span>
            {belowFloor ? (
              <span className="retail-cart-outcome-profit retail-cart-outcome-profit--warn">Dưới giá sàn!</span>
            ) : (
              <span className="retail-cart-outcome-profit" title={moneyTitle(profitUnit * item.qty)}>
                LN +{fmt(profitUnit * item.qty)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
