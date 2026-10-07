import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_GAP = 8;
const VIEWPORT_PAD = 16;

/**
 * Portal menu — không bị cắt bởi overflow của card cha.
 */
export function useAppleMenuPosition({
  open,
  onOpenChange,
  align = 'end',
  minWidth = 260,
  matchAnchorWidth = false,
}) {
  const anchorRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setMenuStyle(null);
      return undefined;
    }

    const place = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let width = matchAnchorWidth ? rect.width : Math.max(rect.width, minWidth);
      width = Math.max(1, Math.min(width, vw - VIEWPORT_PAD * 2));

      let left = align === 'end' ? rect.right - width : rect.left;

      if (matchAnchorWidth || align === 'start') {
        left = rect.left;
        width = Math.min(width, vw - rect.left - VIEWPORT_PAD);
      } else {
        left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));
      }

      const spaceBelow = vh - rect.bottom - VIEWPORT_PAD;
      const spaceAbove = rect.top - VIEWPORT_PAD;
      const preferBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove;

      if (preferBelow) {
        setMenuStyle({
          top: rect.bottom + MENU_GAP,
          left,
          width,
          maxHeight: Math.min(420, spaceBelow - MENU_GAP),
        });
      } else {
        setMenuStyle({
          bottom: vh - rect.top + MENU_GAP,
          left,
          width,
          maxHeight: Math.min(420, spaceAbove - MENU_GAP),
        });
      }
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, minWidth, matchAnchorWidth]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      const inAnchor = anchorRef.current?.contains(e.target);
      const inPanel = e.target.closest?.('[data-apple-menu-panel]');
      if (!inAnchor && !inPanel) onOpenChange(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open, onOpenChange]);

  return { anchorRef, menuStyle };
}

export function AppleMenuPanel({ menuStyle, children, id, role = 'menu', className = '' }) {
  if (!menuStyle) return null;

  return createPortal(
    <div
      id={id}
      data-apple-menu-panel
      className={`apple-menu ${className}`.trim()}
      role={role}
      style={{
        position: 'fixed',
        zIndex: 10000,
        ...menuStyle,
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export function AppleMenuItem({
  children,
  selected = false,
  onClick,
  className = '',
  meta,
  role = 'menuitem',
  ...rest
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={role === 'option' ? selected : undefined}
      className={`apple-menu__item${selected ? ' apple-menu__item--selected' : ''} ${className}`.trim()}
      onClick={onClick}
      {...rest}
    >
      <span className="apple-menu__item-label">
        {children}
        {meta ? <span className="apple-menu__item-meta">{meta}</span> : null}
      </span>
      {selected ? (
        <span className="material-symbols-outlined apple-menu__check" aria-hidden>
          check
        </span>
      ) : null}
    </button>
  );
}
