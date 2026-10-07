import SearchField, { SearchFieldRow, SearchFieldRowAction } from '../SearchField';
import { labelClass } from '../formFields';
import { ProductScanIcon } from '../icons/rowActionIcon';

/**
 * Ô quét/nhập mã sản phẩm — cùng layout lv.01 với CustomerSearchPicker (hình 1 Figma).
 * Pill: icon tìm + input · Nút tròn ngoài: camera (+ gợi ý ?).
 */
export default function ProductScanSearchRow({
  label = 'Quét / nhập mã',
  hideLabel = false,
  hideLeadingIcon = false,
  value,
  onChange,
  onSubmit,
  onOpenCamera,
  loading = false,
  showHelp = false,
  onToggleHelp,
  helpText = null,
  placeholder = 'Nhập mã hoặc quét...',
  autoFocus = false,
  ariaLabel,
  note = null,
}) {
  return (
    <div className="product-scan-search">
      {!hideLabel && label ? (
        <label className={`${labelClass} product-scan-search__label`}>{label}</label>
      ) : null}
      <SearchFieldRow
        className="search-field-row--bleed"
        actions={
          <>
            <SearchFieldRowAction
              primary
              type="button"
              onClick={onOpenCamera}
              aria-label="Quét bằng camera"
              title="Quét bằng camera"
            >
              <ProductScanIcon />
            </SearchFieldRowAction>
            {onToggleHelp && (
              <SearchFieldRowAction
                type="button"
                className="search-field-row-action--text"
                onClick={onToggleHelp}
                aria-label="Gợi ý mã thử"
                aria-expanded={showHelp}
              >
                ?
              </SearchFieldRowAction>
            )}
          </>
        }
      >
        <SearchField
          type="text"
          inputMode="search"
          enterKeyHint="search"
          hideLeadingIcon={hideLeadingIcon}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          loading={loading}
          autoFocus={autoFocus}
          aria-label={ariaLabel || label}
        />
      </SearchFieldRow>
      {note ? <p className="product-scan-search__note">{note}</p> : null}
      {showHelp && helpText && <p className="retail-pos-scan-hint">{helpText}</p>}
    </div>
  );
}
