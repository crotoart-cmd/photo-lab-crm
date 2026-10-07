import SymbolNew from '../icons/SymbolNew';

const TAG_STYLES = {
  gold: 'bg-amber-100 text-amber-900 border-amber-200',
  blue: 'bg-sky-100 text-sky-900 border-sky-200',
  amber: 'bg-orange-100 text-orange-900 border-orange-200',
  purple: 'bg-violet-100 text-violet-900 border-violet-200',
  red: 'bg-red-100 text-red-900 border-red-200',
  green: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  gray: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function CustomerTagPill({ tag }) {
  if (!tag) return null;

  if (tag.id === 'new') {
    return <SymbolNew className="customer-tag-new" height={18} title={tag.label} />;
  }

  const cls = TAG_STYLES[tag.tone] || TAG_STYLES.gray;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      {tag.label}
    </span>
  );
}

export function LtvBadge({ grade }) {
  const styles = {
    A: 'bg-amber-500 text-white',
    B: 'bg-sky-500 text-white',
    C: 'bg-slate-400 text-white',
  };
  return (
    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md text-xs font-bold ${styles[grade] || styles.C}`}>
      {grade || 'C'}
    </span>
  );
}
