import { useEffect, useId, useState } from 'react';
import {
  PERIOD_PRESETS,
  getPeriodLabel,
  todayIsoDate,
  daysAgoIsoDate,
} from '../../utils/periodRange';
import { AppleMenuPanel, AppleMenuItem, useAppleMenuPosition } from '../AppleMenu';

/**
 * Dropdown chọn kỳ — preset + tùy chọn ngày (Apple menu style).
 */
export default function PeriodRangeSelect({ value, onChange, className = '' }) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(value.start || daysAgoIsoDate(13));
  const [draftEnd, setDraftEnd] = useState(value.end || todayIsoDate());
  const [customOpen, setCustomOpen] = useState(value.id === 'custom');

  const { anchorRef, menuStyle } = useAppleMenuPosition({
    open,
    onOpenChange: setOpen,
    align: 'end',
    minWidth: 272,
  });

  const label = getPeriodLabel(value);

  useEffect(() => {
    if (!open) {
      setCustomOpen(value.id === 'custom');
    }
  }, [open, value.id]);

  useEffect(() => {
    if (value.id === 'custom') {
      setDraftStart(value.start || daysAgoIsoDate(13));
      setDraftEnd(value.end || todayIsoDate());
    }
  }, [value.id, value.start, value.end]);

  const pickPreset = (id) => {
    if (id === 'custom') {
      setCustomOpen(true);
      return;
    }
    onChange({ id });
    setOpen(false);
    setCustomOpen(false);
  };

  const applyCustom = () => {
    if (!draftStart || !draftEnd || draftStart > draftEnd) return;
    onChange({ id: 'custom', start: draftStart, end: draftEnd });
    setOpen(false);
  };

  const showCustom = customOpen || value.id === 'custom';

  return (
    <div className={`period-range-select ${className}`.trim()} ref={anchorRef}>
      <button
        type="button"
        className="apple-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <span className="material-symbols-outlined apple-menu-trigger__icon" aria-hidden>
          schedule
        </span>
        <span className="apple-menu-trigger__label">{label}</span>
        <span
          className={`material-symbols-outlined apple-menu-trigger__chevron${open ? ' apple-menu-trigger__chevron--open' : ''}`}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      <AppleMenuPanel menuStyle={menuStyle} id={menuId} role="menu">
        <div className="apple-menu__scroll">
          {PERIOD_PRESETS.map((opt) => (
            <AppleMenuItem
              key={opt.id}
              selected={value.id === opt.id && opt.id !== 'custom'}
              onClick={() => pickPreset(opt.id)}
            >
              {opt.label}
            </AppleMenuItem>
          ))}
        </div>

        {showCustom && (
          <div className="apple-menu__footer">
            <p className="apple-menu__section-label">Khoảng ngày</p>
            <div className="apple-menu__dates">
              <label className="apple-menu__date-field">
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={draftStart}
                  max={draftEnd || todayIsoDate()}
                  onChange={(e) => setDraftStart(e.target.value)}
                />
              </label>
              <label className="apple-menu__date-field">
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={draftEnd}
                  min={draftStart}
                  max={todayIsoDate()}
                  onChange={(e) => setDraftEnd(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="apple-menu__action"
              onClick={applyCustom}
              disabled={!draftStart || !draftEnd || draftStart > draftEnd}
            >
              Áp dụng
            </button>
          </div>
        )}
      </AppleMenuPanel>
    </div>
  );
}
