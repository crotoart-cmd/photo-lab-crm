import { Children, isValidElement, useId, useMemo, useState } from 'react';
import { AppleMenuItem, AppleMenuPanel, useAppleMenuPosition } from './AppleMenu';

function parseOptions(children) {
  return Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === 'option')
    .map((child) => ({
      value: child.props.value ?? '',
      label:
        typeof child.props.children === 'string'
          ? child.props.children
          : String(child.props.children ?? ''),
      disabled: Boolean(child.props.disabled),
    }));
}

/**
 * Select kiểu Apple menu — thay <select> native trên mobile/form.
 */
export default function AppleSelect({
  value,
  onChange,
  children,
  placeholder = 'Chọn…',
  disabled = false,
  className = '',
  id,
  name,
  align = 'start',
  'aria-label': ariaLabel,
}) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const { anchorRef, menuStyle } = useAppleMenuPosition({
    open,
    onOpenChange: setOpen,
    align,
    matchAnchorWidth: true,
  });

  const options = useMemo(() => parseOptions(children), [children]);
  const stringValue = value == null ? '' : String(value);
  const selected = options.find((opt) => String(opt.value) === stringValue);
  const placeholderOption = options.find((opt) => opt.value === '');
  const menuOptions = options.filter((opt) => opt.value !== '');

  const displayLabel =
    selected && selected.value !== ''
      ? selected.label
      : placeholderOption?.label || placeholder;

  const pick = (nextValue) => {
    onChange?.({ target: { value: nextValue, name } });
    setOpen(false);
  };

  return (
    <div className={`apple-select ${className}`.trim()} ref={anchorRef}>
      <button
        type="button"
        id={id}
        className={`apple-menu-trigger apple-select__trigger${
          disabled ? ' apple-select__trigger--disabled' : ''
        }`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
      >
        <span
          className={`apple-menu-trigger__label${
            !selected || selected.value === '' ? ' apple-select__placeholder' : ''
          }`}
        >
          {displayLabel}
        </span>
        <span
          className={`material-symbols-outlined apple-menu-trigger__chevron${
            open ? ' apple-menu-trigger__chevron--open' : ''
          }`}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      <AppleMenuPanel menuStyle={menuStyle} id={menuId} role="listbox">
        <div className="apple-menu__scroll">
          {menuOptions.length === 0 ? (
            <p className="apple-menu__empty">Không có lựa chọn</p>
          ) : (
            menuOptions.map((opt) => (
              <AppleMenuItem
                key={opt.value}
                role="option"
                selected={stringValue === String(opt.value)}
                onClick={() => !opt.disabled && pick(opt.value)}
              >
                {opt.label}
              </AppleMenuItem>
            ))
          )}
        </div>
      </AppleMenuPanel>
    </div>
  );
}
