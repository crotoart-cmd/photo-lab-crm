import TextField from '../TextField';

export default function MfaCodeField({ value, onChange, recovery, onRecoveryChange, autoFocus = false, disabled = false }) {
  return (
    <div className="mfa-code-field">
      <div className="apple-segmented mb-3" role="group" aria-label="Phương thức xác thực">
        {[false, true].map((mode) => (
          <button key={String(mode)} type="button" disabled={disabled} aria-pressed={recovery === mode}
            className={`apple-segment flex-1 ${recovery === mode ? 'apple-segment-active' : ''}`}
            onClick={() => { onRecoveryChange(mode); onChange(''); }}>
            {mode ? 'Mã dự phòng' : 'Mã Authenticator'}
          </button>
        ))}
      </div>
      <TextField label={recovery ? 'Mã dự phòng' : 'Mã 6 số'} value={value} required disabled={disabled}
        onChange={(event) => onChange(event.target.value)} autoFocus={autoFocus} autoComplete="one-time-code"
        inputMode={recovery ? 'text' : 'numeric'} pattern={recovery ? undefined : '[0-9]{6}'}
        minLength={recovery ? 32 : 6} maxLength={recovery ? 43 : 6}
        placeholder={recovery ? 'XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX' : '000000'} />
    </div>
  );
}
