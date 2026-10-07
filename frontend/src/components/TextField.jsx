import { useId, useMemo } from 'react';
import IconLoading from './icons/IconLoading';
import { ICON_SIZE } from './icons/iconSizes';

/**
 * TextField — Figma text field
 * textSize: normal (16px) | 25 (25px large / textarea)
 * fee, charCount, multiline
 */
export default function TextField({
  label,
  required = false,
  hint,
  error,
  helperText,
  fee,
  leadingIcon,
  leadingIconComponent = null,
  trailingIcon,
  trailingIconComponent = null,
  onTrailingClick,
  trailingLabel,
  loading = false,
  readOnly = false,
  multiline = false,
  textSize = 'normal',
  maxLength,
  showCharCount = false,
  charCountThreshold = 10,
  className = '',
  inputClassName = '',
  id: idProp,
  value = '',
  ...props
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const helperId = `${id}-helper`;
  const hasError = Boolean(error);
  const message = hasError ? error : helperText || hint;

  const charLen = String(value ?? '').length;
  const showCount =
    showCharCount === true ||
    (showCharCount !== false &&
      ((maxLength != null && charLen > 0) || charLen > charCountThreshold));

  const countLabel = useMemo(() => {
    if (maxLength != null) return `${charLen}/${maxLength}`;
    if (charLen > charCountThreshold) return String(charLen);
    return null;
  }, [charLen, maxLength, charCountThreshold]);

  const rootClass = [
    'text-field',
    textSize === 25 || textSize === '25' ? 'text-field--text-25' : '',
    multiline && 'text-field--multiline',
    hasError && 'text-field--error',
    props.disabled && 'text-field--disabled',
    readOnly && 'text-field--readonly',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const InputTag = multiline ? 'textarea' : 'input';
  const describedBy = [message && helperId, fee && `${id}-fee`, showCount && countLabel && `${id}-count`]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={rootClass}>
      {label && (
        <label className="text-field__label" htmlFor={id}>
          {label}
          {required && <span className="text-field__label-required">*</span>}
        </label>
      )}

      <div className="text-field__control">
        {leadingIconComponent ? (
          <span className="text-field__icon text-field__icon--custom" aria-hidden="true">
            {leadingIconComponent}
          </span>
        ) : leadingIcon ? (
          <span className="text-field__icon" aria-hidden="true">
            <span className="material-symbols-outlined">{leadingIcon}</span>
          </span>
        ) : null}

        <InputTag
          id={id}
          className={`text-field__input ${inputClassName}`.trim()}
          readOnly={readOnly}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          value={value}
          maxLength={maxLength}
          {...props}
        />

        {loading && (
          <span className="text-field__icon text-field__icon--loading" aria-hidden="true">
            <IconLoading framed={false} size={ICON_SIZE.field} />
          </span>
        )}

        {!loading && (trailingIconComponent || trailingIcon) && (
          onTrailingClick ? (
            <button
              type="button"
              className={`text-field__icon text-field__icon--action${trailingIconComponent ? ' text-field__icon--custom' : ''}`}
              onClick={onTrailingClick}
              aria-label={trailingLabel || 'Thao tác'}
              tabIndex={-1}
            >
              {trailingIconComponent || (
                <span className="material-symbols-outlined">{trailingIcon}</span>
              )}
            </button>
          ) : (
            <span
              className={`text-field__icon${trailingIconComponent ? ' text-field__icon--custom' : ''}`}
              aria-hidden="true"
            >
              {trailingIconComponent || (
                <span className="material-symbols-outlined">{trailingIcon}</span>
              )}
            </span>
          )
        )}
      </div>

      {(message || fee || (showCount && countLabel)) && (
        <div className="text-field__footer">
          {message ? (
            <p
              id={helperId}
              className={`text-field__helper${hasError ? ' text-field__helper--error' : ''}`}
              role={hasError ? 'alert' : undefined}
            >
              {message}
            </p>
          ) : (
            <span className="text-field__footer-spacer" />
          )}

          <div className="text-field__footer-meta">
            {fee && (
              <span id={`${id}-fee`} className="text-field__fee">
                {fee}
              </span>
            )}
            {showCount && countLabel && (
              <span id={`${id}-count`} className="text-field__count" aria-live="polite">
                {countLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
