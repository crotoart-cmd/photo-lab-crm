/**
 * SearchField — Figma pill search input + row lv.01 (ô tìm + 1–2 nút cạnh)
 */
import IconLoading from './icons/IconLoading';
import { ICON_SIZE } from './icons/iconSizes';

export function SearchFieldRowAction({
  children,
  primary = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`search-field-row-action${primary ? ' search-field-row-action--primary' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

/** Hàng lv.01: pill tìm kiếm + 1 hoặc 2 nút bên phải (gap 12px, cao 48px) */
export function SearchFieldRow({ children, actions = null, className = '' }) {
  const actionNodes = actions ? (Array.isArray(actions) ? actions : [actions]).filter(Boolean) : [];

  return (
    <div className={`search-field-row search-field-row--lv01 ${className}`.trim()}>
      <div className="search-field-row__field">{children}</div>
      {actionNodes.length > 0 && (
        <div className="search-field-row__actions" data-action-count={actionNodes.length}>
          {actionNodes}
        </div>
      )}
    </div>
  );
}

export function SearchFieldAction({
  children,
  primary = false,
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`search-field-action${primary ? ' search-field-action--primary' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export default function SearchField({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  placeholder,
  loading = false,
  disabled = false,
  leadingIcon = 'search',
  hideLeadingIcon = false,
  trailing = null,
  className = '',
  inputClassName = '',
  type = 'search',
  inputRef,
  ...rest
}) {
  const hasTrailing = Boolean(trailing);

  const handleKeyDown = (e) => {
    onKeyDown?.(e);
    if (e.key === 'Enter' && onSubmit && !e.defaultPrevented) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  return (
    <div
      className={`search-field${hasTrailing ? ' search-field--with-trailing' : ''} ${className}`.trim()}
    >
      {!hideLeadingIcon && leadingIcon && !loading && (
        <span className="search-field-icon" aria-hidden="true">
          <span className="material-symbols-outlined">{leadingIcon}</span>
        </span>
      )}
      {loading && (
        <span className="search-field-icon search-field-icon--loading" aria-hidden="true">
          <IconLoading size={ICON_SIZE.field} framed />
        </span>
      )}
      <input
        ref={inputRef}
        type={type}
        className={`search-field-input ${inputClassName}`.trim()}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || loading}
        {...rest}
      />
      {hasTrailing && <div className="search-field-trailing">{trailing}</div>}
    </div>
  );
}
