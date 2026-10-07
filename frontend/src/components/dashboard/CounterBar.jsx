/**
 * Counter strip — Figma ~98px, mobile dashboard
 */
export default function CounterBar({ items = [] }) {
  if (!items.length) return null;

  return (
    <div className="counter-bar" role="group" aria-label="Chỉ số vận hành">
      <div className="counter-bar__track">
        {items.map((item) => (
          <div
            key={item.id}
            className={`counter-bar__item counter-bar__item--${item.variant || 'default'}`}
          >
            <span className="counter-bar__value">{item.value}</span>
            <span className="counter-bar__label">{item.label}</span>
            {item.hint ? <span className="counter-bar__hint">{item.hint}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
