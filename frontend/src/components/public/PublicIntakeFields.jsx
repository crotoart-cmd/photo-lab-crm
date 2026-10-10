export function Field({ label, required, children }) {
  return (
    <label className="ps-field">
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  );
}

export function SelectOptions({ options }) {
  return options.map((o) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  ));
}

export function Honeypot() {
  return (
    <label className="ps-hp" aria-hidden="true">
      Website
      <input type="text" name="website" tabIndex={-1} autoComplete="off" />
    </label>
  );
}
