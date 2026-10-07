import { suggestFromCost, formatOfferInput, parseOfferInput } from '../utils/retailPricing';
import { inputClass, labelClass } from './formFields';

/**
 * Giá nhập + niêm yết (sửa được). Giá sàn = giá nhập (chỉ đọc).
 * @param {'default'|'cart-strip'} [variant] — cart-strip: layout giống thẻ giỏ Bán (mobile Nhập)
 */
export default function PriceFieldsRow({ cost, price, onChange, variant = 'default' }) {
  const floor = Number(cost) || 0;

  const handleCost = (raw) => {
    const n = Number(raw);
    if (!raw || raw === '') {
      onChange({ cost: '', price: price || '', floor_price: 0 });
      return;
    }
    const suggested = suggestFromCost(n);
    const keepPrice = Number(price) > 0 ? price : suggested.price;
    onChange({ cost: raw, price: keepPrice, floor_price: n });
  };

  if (variant === 'cart-strip') {
    return (
      <div className="retail-intake-price-block">
        <div className="retail-cart-ref retail-intake-price-ref">
          <div className="retail-cart-ref-item">
            <label className="retail-cart-ref-label" htmlFor="intake-price-cost">
              Giá nhập (VNĐ)
            </label>
            <input
              id="intake-price-cost"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className={`${inputClass} retail-intake-price-input ios-input`}
              placeholder="VD: 3.500.000"
              value={formatOfferInput(cost)}
              onChange={(e) => handleCost(parseOfferInput(e.target.value))}
            />
          </div>
          <div className="retail-cart-ref-item">
            <label className="retail-cart-ref-label" htmlFor="intake-price-list">
              Giá bán niêm yết
            </label>
            <input
              id="intake-price-list"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className={`${inputClass} retail-intake-price-input retail-intake-price-input--list ios-input`}
              placeholder="VD: 5.000.000"
              value={formatOfferInput(price)}
              onChange={(e) => onChange({ price: parseOfferInput(e.target.value) })}
            />
          </div>
          <div className="retail-cart-ref-item">
            <span className="retail-cart-ref-label retail-intake-price-floor-label">Giá sàn (= giá nhập)</span>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              aria-readonly="true"
              placeholder="0 đ"
              className={`${inputClass} retail-intake-price-input retail-intake-price-input--floor ios-input`}
              value={floor > 0 ? `${formatOfferInput(floor)} đ` : ''}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="price-fields-row grid grid-cols-2 md:grid-cols-3 gap-3">
      <div>
        <label className={labelClass}>Giá nhập (VNĐ)</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          className={`${inputClass} price-fields-row__input`}
          placeholder="VD: 3.500.000"
          value={formatOfferInput(cost)}
          onChange={(e) => handleCost(parseOfferInput(e.target.value))}
        />
      </div>
      <div>
        <label className={labelClass}>Giá bán niêm yết</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          className={`${inputClass} price-fields-row__input`}
          placeholder="VD: 5.000.000"
          value={formatOfferInput(price)}
          onChange={(e) => onChange({ price: parseOfferInput(e.target.value) })}
        />
      </div>
      <div className="col-span-2 md:col-span-1">
        <label className={`${labelClass} text-red-600`}>Giá sàn (= giá nhập)</label>
        <input
          type="text"
          readOnly
          className={`${inputClass} bg-red-50 border-red-200 text-red-800 font-semibold cursor-default`}
          value={floor > 0 ? `${formatOfferInput(floor)} đ` : ''}
          placeholder="0 đ"
          tabIndex={-1}
        />
        <p className="price-fields-row__floor-hint">Không bán offer dưới mức này</p>
      </div>
    </div>
  );
}
