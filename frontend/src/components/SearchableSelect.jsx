import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AppleMenuItem, AppleMenuPanel, useAppleMenuPosition } from './AppleMenu';

function normalize(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Combobox — gõ để lọc danh sách dài (thay AppleSelect khi có nhiều option).
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Chọn…',
  disabled = false,
  className = '',
  id,
  name,
  align = 'start',
}) {
  const menuId = useId();
  const inputRef = useRef(null);
  const pickingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const { anchorRef, menuStyle } = useAppleMenuPosition({
    open,
    onOpenChange: setOpen,
    align,
    matchAnchorWidth: true,
  });

  const stringValue = value == null ? '' : String(value);
  const menuOptions = useMemo(
    () => options.filter((opt) => opt.value !== '' && !opt.disabled),
    [options],
  );

  const selected = useMemo(
    () => menuOptions.find((opt) => String(opt.value) === stringValue) || null,
    [menuOptions, stringValue],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return menuOptions;
    return menuOptions.filter(
      (opt) => normalize(opt.label).includes(q) || normalize(opt.value).includes(q),
    );
  }, [menuOptions, query]);

  // Đồng bộ text hiển thị khi value đổi từ bên ngoài (không ghi đè lúc đang mở menu / vừa chọn).
  useEffect(() => {
    if (open || pickingRef.current) return;
    setQuery(selected?.label || '');
  }, [stringValue, selected?.label, open]);

  useEffect(() => {
    setHighlightIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const pick = (nextValue) => {
    const opt = menuOptions.find((o) => String(o.value) === String(nextValue));
    pickingRef.current = true;
    setQuery(opt?.label || '');
    setOpen(false);
    onChange?.({ target: { value: nextValue, name } });
    window.setTimeout(() => {
      pickingRef.current = false;
    }, 0);
  };

  const tryExactMatch = (text) => {
    const q = normalize(text);
    if (!q) return false;
    const hit = menuOptions.find(
      (opt) => normalize(opt.label) === q || normalize(opt.value) === q,
    );
    if (hit) {
      pick(hit.value);
      return true;
    }
    return false;
  };

  const handleFocus = () => {
    if (disabled) return;
    setOpen(true);
    setQuery(selected?.label || '');
    window.setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (pickingRef.current) return;
      if (!tryExactMatch(query)) {
        setQuery(selected?.label || '');
      }
      setOpen(false);
    }, 180);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlightIndex]) {
        pick(filtered[highlightIndex].value);
      } else {
        tryExactMatch(query);
        setOpen(false);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery(selected?.label || '');
      setOpen(false);
    }
  };

  return (
    <div className={`searchable-select ${className}`.trim()} ref={anchorRef}>
      <div
        className={`searchable-select__field${
          disabled ? ' searchable-select__field--disabled' : ''
        }`}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="searchable-select__input"
          value={query}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={menuId}
          role="combobox"
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <span
          className={`material-symbols-outlined searchable-select__chevron${
            open ? ' searchable-select__chevron--open' : ''
          }`}
          aria-hidden
        >
          expand_more
        </span>
      </div>

      <AppleMenuPanel menuStyle={menuStyle} id={menuId} role="listbox" className="apple-menu--combobox">
        <div className="apple-menu__scroll">
          {filtered.length === 0 ? (
            <p className="apple-menu__empty">Không có kết quả</p>
          ) : (
            filtered.map((opt, index) => (
              <AppleMenuItem
                key={opt.value}
                role="option"
                selected={stringValue === String(opt.value)}
                className={index === highlightIndex ? 'apple-menu__item--highlight' : ''}
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(opt.value);
                }}
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
