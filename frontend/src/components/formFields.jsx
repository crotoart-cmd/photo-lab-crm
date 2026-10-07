/** Form controls — Figma TextField + legacy class tokens */

import TextField from './TextField';
import AppleSelect from './AppleSelect';
import SearchableSelect from './SearchableSelect';

export const labelClass = 'form-label';

/** @deprecated Prefer <TextField /> — kept for gradual migration */
export const inputClass =
  'form-input w-full transition focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/25 focus:border-[var(--color-blue)]';

export const textareaClass =
  'form-textarea w-full transition focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/25 focus:border-[var(--color-blue)]';

export const selectClass =
  'form-select apple-picker w-full transition focus:outline-none focus:ring-2 focus:ring-[var(--color-blue)]/25 focus:border-[var(--color-blue)]';

/** Panel tối (POS / AI) */
export const inputClassDark =
  'w-full text-[length:var(--font-input)] text-white bg-white/10 border border-white/25 rounded-xl px-4 py-3 placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40';

export function LabeledInput({
  label,
  required,
  hint,
  error,
  helperText,
  leadingIcon,
  leadingIconComponent,
  trailingIcon,
  trailingIconComponent,
  onTrailingClick,
  trailingLabel,
  loading,
  className = '',
  inputClassName = '',
  ...props
}) {
  return (
    <TextField
      label={label}
      required={required}
      hint={hint}
      error={error}
      helperText={helperText}
      leadingIcon={leadingIcon}
      leadingIconComponent={leadingIconComponent}
      trailingIcon={trailingIcon}
      trailingIconComponent={trailingIconComponent}
      onTrailingClick={onTrailingClick}
      trailingLabel={trailingLabel}
      loading={loading}
      className={className}
      inputClassName={inputClassName}
      {...props}
    />
  );
}

export function LabeledTextarea({
  label,
  required,
  hint,
  error,
  helperText,
  fee,
  textSize = 'normal',
  className = '',
  ...props
}) {
  return (
    <TextField
      label={label}
      required={required}
      hint={hint}
      error={error}
      helperText={helperText}
      fee={fee}
      multiline
      textSize={textSize}
      className={className}
      {...props}
    />
  );
}

export function LabeledSelect({ label, required, className = '', children, ...props }) {
  return (
    <div className={`form-field-min ${className}`.trim()}>
      {label && (
        <label className={labelClass}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <AppleSelect {...props}>{children}</AppleSelect>
    </div>
  );
}

export function LabeledSearchableSelect({
  label,
  required,
  className = '',
  options,
  placeholder,
  ...props
}) {
  return (
    <div className={`form-field-min ${className}`.trim()}>
      {label && (
        <label className={labelClass}>
          {label}
          {required ? ' *' : ''}
        </label>
      )}
      <SearchableSelect options={options} placeholder={placeholder} {...props} />
    </div>
  );
}

export { default as SearchableSelect } from './SearchableSelect';

export { TextField };
