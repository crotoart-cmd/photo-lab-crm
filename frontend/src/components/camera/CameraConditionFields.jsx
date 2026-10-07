import {
  CONDITION_GRADES,
  DEFECT_TAGS,
  computeTrueCost,
  formatVnd,
} from '../../constants/cameraLifecycle';

export default function CameraConditionFields({
  value,
  onChange,
  dark = false,
  showCostPreview = false,
}) {
  const v = value || {};
  const patch = (updates) => onChange?.({ ...v, ...updates });

  const toggleTag = (id) => {
    const tags = new Set(v.defect_tags || []);
    if (tags.has(id)) tags.delete(id);
    else tags.add(id);
    const next = [...tags];
    patch({
      defect_tags: next,
      has_defect: next.length > 0 || v.condition_grade !== 'A',
    });
  };

  const onGradeChange = (grade) => {
    const tags = v.defect_tags || [];
    patch({
      condition_grade: grade,
      has_defect: grade !== 'A' || tags.length > 0,
    });
  };

  const labelCls = dark
    ? 'text-[11px] font-medium text-slate-300 mb-1 block'
    : 'text-[11px] font-medium text-[var(--color-label-secondary)] mb-1 block';

  const trueCost = computeTrueCost(v);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(v.has_defect)}
          onChange={(e) => {
            const checked = e.target.checked;
            if (!checked) {
              patch({
                has_defect: false,
                defect_tags: [],
                condition_grade: 'A',
              });
              return;
            }
            patch({
              has_defect: true,
              condition_grade: v.condition_grade === 'A' ? 'C' : v.condition_grade,
            });
          }}
          className="rounded border-[var(--color-separator)]"
        />
        <span className={dark ? 'text-slate-200' : 'text-[var(--color-label)]'}>
          Máy có lỗi / cần sửa
        </span>
      </label>

      <div>
        <span className={labelCls}>Hạng tình trạng</span>
        <div className="flex flex-wrap gap-1.5">
          {CONDITION_GRADES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onGradeChange(g.id)}
              className={`camera-filter-pill ${v.condition_grade === g.id ? 'camera-filter-pill-active' : ''}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {(v.has_defect || (v.defect_tags?.length || 0) > 0) && (
        <div>
          <span className={labelCls}>Loại lỗi</span>
          <div className="flex flex-wrap gap-1.5">
            {DEFECT_TAGS.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`camera-defect-tag ${(v.defect_tags || []).includes(tag.id) ? 'camera-defect-tag-active' : ''}`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showCostPreview && (
        <div className="camera-cost-row">
          <div>
            <p>Giá mua</p>
            <strong>{formatVnd(v.cost)}</strong>
          </div>
          <div>
            <p>Tiền sửa</p>
            <strong>{formatVnd(v.total_repair_cost)}</strong>
          </div>
          <div>
            <p>Vốn thực</p>
            <strong className="text-[var(--color-blue)]">{formatVnd(trueCost)}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
