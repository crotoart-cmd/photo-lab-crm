import {
  CANISTER_CONDITIONS,
  COLOR_TONES,
  CUT_FILM,
  FILM_FORMATS,
  FILM_STUCK,
  FILM_TYPE_DETAILS,
  ISO_HANDLING,
  LEADER_STATUS,
  ORIGINAL_RETURN,
  PAYMENT_STATUS,
  PROCESSING_PROCESSES,
  SCAN_FORMATS,
  SCAN_RESOLUTIONS,
  WET_MOLD,
  labelOf,
} from '../utils/intakeOptions';

const Row = ({ label, value }) =>
  value && value !== '—' ? (
    <div className="flex justify-between gap-4 text-sm py-0.5">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  ) : null;

const Block = ({ title, children }) => (
  <div className="border-t border-slate-100 pt-3 mt-3 first:mt-0 first:border-0 first:pt-0">
    <p className="text-xs font-semibold text-lab-700 uppercase tracking-wide mb-2">{title}</p>
    <div className="space-y-0.5">{children}</div>
  </div>
);

export default function IntakeChecklistView({ checklist, compact = false }) {
  if (!checklist) {
    return <p className="text-sm text-slate-400">Chưa có checklist tiếp nhận</p>;
  }

  const c = checklist;

  if (compact) {
    return (
      <div className="text-xs text-slate-600 space-y-1">
        <p>
          {labelOf(FILM_FORMATS, c.filmFormat)} · {labelOf(FILM_TYPE_DETAILS, c.filmTypeDetail)} ·{' '}
          {labelOf(PROCESSING_PROCESSES, c.processingProcess)}
        </p>
        <p>
          Scan: {labelOf(SCAN_RESOLUTIONS, c.scanResolution)} {labelOf(SCAN_FORMATS, c.scanFileFormat)} ·{' '}
          {labelOf(PAYMENT_STATUS, c.paymentStatus)}
        </p>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <Block title="1. Loại phim">
        <Row label="Khổ" value={labelOf(FILM_FORMATS, c.filmFormat)} />
        {c.filmFormatNote && <Row label="Ghi chú khổ" value={c.filmFormatNote} />}
        <Row label="Loại" value={labelOf(FILM_TYPE_DETAILS, c.filmTypeDetail)} />
        <Row label="Quy trình" value={labelOf(PROCESSING_PROCESSES, c.processingProcess)} />
        {c.processingProcessNote && <Row label="Ghi chú QT" value={c.processingProcessNote} />}
      </Block>

      <Block title="2. Tình trạng vật lý">
        <Row label="Leader" value={labelOf(LEADER_STATUS, c.leaderStatus)} />
        <Row label="Vỏ" value={labelOf(CANISTER_CONDITIONS, c.canisterCondition)} />
        {c.canisterConditionNote && <Row label="Chi tiết vỏ" value={c.canisterConditionNote} />}
        <Row label="Kẹt/đứt" value={labelOf(FILM_STUCK, c.filmStuckBroken)} />
        {c.filmStuckBrokenNote && <Row label="Chi tiết kẹt" value={c.filmStuckBrokenNote} />}
        <Row label="Ẩm/mốc" value={labelOf(WET_MOLD, c.wetMold)} />
        {c.wetMoldNote && <Row label="Chi tiết mốc" value={c.wetMoldNote} />}
      </Block>

      <Block title="3. Xử lý kỹ thuật">
        <Row label="ISO" value={labelOf(ISO_HANDLING, c.isoHandling)} />
        {c.isoValue && <Row label="ISO gốc" value={String(c.isoValue)} />}
        {c.pushPullStops && <Row label="Stop" value={`${c.pushPullStops}`} />}
        <Row label="Cắt phim" value={labelOf(CUT_FILM, c.cutFilm)} />
        <Row label="File scan" value={labelOf(SCAN_FORMATS, c.scanFileFormat)} />
        <Row label="Độ phân giải" value={labelOf(SCAN_RESOLUTIONS, c.scanResolution)} />
        <Row label="Tông màu" value={labelOf(COLOR_TONES, c.colorTone)} />
        {c.technicalNotes && <Row label="Ghi chú KT" value={c.technicalNotes} />}
      </Block>

      <Block title="4. Giao nhận & TT">
        <Row label="Liên lạc" value={c.contactVerified ? 'Đã xác nhận ✓' : 'Chưa xác nhận'} />
        <Row label="Họ tên" value={c.contactName} />
        <Row label="SĐT" value={c.contactPhone} />
        <Row label="Email" value={c.contactEmail} />
        <Row
          label="Hẹn trả"
          value={
            c.promisedReturnAt
              ? new Date(c.promisedReturnAt).toLocaleString('vi-VN')
              : null
          }
        />
        <Row label="Film gốc" value={labelOf(ORIGINAL_RETURN, c.originalFilmReturn)} />
        {c.shippingAddress && <Row label="Địa chỉ ship" value={c.shippingAddress} />}
        <Row label="Thanh toán" value={labelOf(PAYMENT_STATUS, c.paymentStatus)} />
        {c.paymentAmount != null && c.paymentAmount !== '' && (
          <Row label="Số tiền" value={`${Number(c.paymentAmount).toLocaleString('vi-VN')} đ`} />
        )}
        {c.inspectedBy && <Row label="NV kiểm tra" value={c.inspectedBy} />}
        {c.paymentNote && <Row label="Ghi chú" value={c.paymentNote} />}
      </Block>
    </div>
  );
}
