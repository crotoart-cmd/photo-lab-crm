import { STATUS_LABELS } from '../utils/filmLabels';

const STEPS = ['received', 'processing', 'completed', 'delivered'];

const stepIndex = (status) => {
  const i = STEPS.indexOf(status);
  return i >= 0 ? i : 0;
};

export default function ProgressTimeline({ film }) {
  const current = stepIndex(film.status);
  const history = film.statusHistory || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-1">
        {STEPS.map((step, idx) => {
          const done = idx <= current;
          const active = idx === current;
          return (
            <div key={step} className="flex-1 flex flex-col items-center text-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  done
                    ? active
                      ? 'bg-lab-600 border-lab-600 text-white'
                      : 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {idx + 1}
              </div>
              <p className={`text-[10px] mt-1 leading-tight ${done ? 'text-lab-800 font-medium' : 'text-slate-400'}`}>
                {STATUS_LABELS[step]}
              </p>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <ul className="border-t pt-3 space-y-2 max-h-40 overflow-y-auto">
          {[...history].reverse().map((entry, i) => (
            <li key={i} className="text-xs text-slate-600 flex justify-between gap-2">
              <span>
                <strong>{STATUS_LABELS[entry.status] || entry.status}</strong>
                {entry.note ? ` — ${entry.note}` : ''}
              </span>
              <span className="text-slate-400 shrink-0">
                {entry.at ? new Date(entry.at).toLocaleString('vi-VN') : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
