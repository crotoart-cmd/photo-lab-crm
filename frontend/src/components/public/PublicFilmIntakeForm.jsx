import { useState } from 'react';
import publicApi from '../../api/publicClient';
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
  PROCESSING_PROCESSES,
  SCAN_FORMATS,
  SCAN_RESOLUTIONS,
  WET_MOLD,
  defaultIntakeChecklist,
} from '../../utils/intakeOptions';
import { Field, Honeypot, SelectOptions } from './PublicIntakeFields';

const PUBLIC_FILM_STUCK = FILM_STUCK.filter((o) => o.value !== 'yes_found_on_inspection');

const emptyCustomer = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
};

export default function PublicFilmIntakeForm() {
  const [customer, setCustomer] = useState(emptyCustomer);
  const [quantity, setQuantity] = useState(1);
  const [checklist, setChecklist] = useState(() => defaultIntakeChecklist());
  const [receptionNotes, setReceptionNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const set = (key, value) => setChecklist((prev) => ({ ...prev, [key]: value }));

  const onFilmTypeDetailChange = (detail) => {
    const processMap = {
      color_negative: 'c41',
      black_white: 'bw_standard',
      slide_e6: 'e6',
    };
    setChecklist((prev) => ({
      ...prev,
      filmTypeDetail: detail,
      processingProcess: processMap[detail] || prev.processingProcess,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    setSaving(true);
    try {
      const { data } = await publicApi.post('/public/film', {
        ...customer,
        website,
        quantity,
        receptionNotes,
        ...checklist,
      });
      setDone(data.message || `Đã nhận đơn ${data.ticketNumber}`);
      setCustomer(emptyCustomer);
      setQuantity(1);
      setChecklist(defaultIntakeChecklist());
      setReceptionNotes('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không gửi được đơn. Thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="gui-don" className="ps-section">
      <h2>Gửi đơn tráng</h2>
      <p className="ps-form-lead">
        Cùng các mục lab dùng khi tiếp nhận — bạn điền phần của mình. Lab xác nhận film khi nhận cuộn.
      </p>
      {error ? <p className="ps-form-banner ps-form-banner--error">{error}</p> : null}
      {done ? <p className="ps-form-banner ps-form-banner--ok">{done}</p> : null}
      <form className="ps-form" onSubmit={handleSubmit}>
        <Honeypot />
        <input
          className="ps-hp"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <h3>Khách hàng</h3>
        <div className="ps-form-grid">
          <Field label="Họ" required>
            <input
              required
              placeholder="Nguyễn"
              value={customer.firstName}
              onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })}
            />
          </Field>
          <Field label="Tên" required>
            <input
              required
              placeholder="Văn A"
              value={customer.lastName}
              onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })}
            />
          </Field>
          <Field label="Email" required>
            <input
              required
              type="email"
              placeholder="email@example.com"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </Field>
          <Field label="Số điện thoại" required>
            <input
              required
              inputMode="tel"
              placeholder="0901234567"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </Field>
          <Field label="Địa chỉ">
            <input
              placeholder="Số nhà, đường..."
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
            />
          </Field>
          <Field label="Thành phố">
            <input
              placeholder="Hà Nội"
              value={customer.city}
              onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
            />
          </Field>
          <Field label="Mã bưu điện">
            <input
              placeholder="100000"
              value={customer.postalCode}
              onChange={(e) => setCustomer({ ...customer, postalCode: e.target.value })}
            />
          </Field>
          <Field label="Số cuộn film giao" required>
            <input
              required
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </Field>
        </div>

        <h3>Loại phim</h3>
        <div className="ps-form-grid">
          <Field label="Khổ phim" required>
            <select value={checklist.filmFormat} onChange={(e) => set('filmFormat', e.target.value)}>
              <SelectOptions options={FILM_FORMATS} />
            </select>
          </Field>
          {checklist.filmFormat === 'other' ? (
            <Field label="Ghi chú khổ phim">
              <input
                value={checklist.filmFormatNote}
                onChange={(e) => set('filmFormatNote', e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Loại phim" required>
            <select
              value={checklist.filmTypeDetail}
              onChange={(e) => onFilmTypeDetailChange(e.target.value)}
            >
              <SelectOptions options={FILM_TYPE_DETAILS} />
            </select>
          </Field>
          <Field label="Quy trình tráng" required>
            <select
              value={checklist.processingProcess}
              onChange={(e) => set('processingProcess', e.target.value)}
            >
              <SelectOptions options={PROCESSING_PROCESSES} />
            </select>
          </Field>
          {checklist.processingProcess === 'other' ? (
            <Field label="Ghi chú quy trình">
              <input
                value={checklist.processingProcessNote}
                onChange={(e) => set('processingProcessNote', e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <h3>Tình trạng vật lý</h3>
        <div className="ps-form-grid">
          <Field label="Đầu phim (Leader)" required>
            <select value={checklist.leaderStatus} onChange={(e) => set('leaderStatus', e.target.value)}>
              <SelectOptions options={LEADER_STATUS} />
            </select>
          </Field>
          <Field label="Tình trạng vỏ" required>
            <select
              value={checklist.canisterCondition}
              onChange={(e) => set('canisterCondition', e.target.value)}
            >
              <SelectOptions options={CANISTER_CONDITIONS} />
            </select>
          </Field>
          <Field label="Phim kẹt / đứt" required>
            <select
              value={checklist.filmStuckBroken}
              onChange={(e) => set('filmStuckBroken', e.target.value)}
            >
              <SelectOptions options={PUBLIC_FILM_STUCK} />
            </select>
          </Field>
          <Field label="Phim ướt / mốc" required>
            <select value={checklist.wetMold} onChange={(e) => set('wetMold', e.target.value)}>
              <SelectOptions options={WET_MOLD} />
            </select>
          </Field>
          {checklist.canisterCondition !== 'ok' ? (
            <Field label="Chi tiết tình trạng vỏ">
              <input
                value={checklist.canisterConditionNote}
                onChange={(e) => set('canisterConditionNote', e.target.value)}
              />
            </Field>
          ) : null}
          {checklist.filmStuckBroken !== 'no' ? (
            <Field label="Chi tiết kẹt / đứt">
              <input
                value={checklist.filmStuckBrokenNote}
                onChange={(e) => set('filmStuckBrokenNote', e.target.value)}
              />
            </Field>
          ) : null}
          {checklist.wetMold !== 'no' ? (
            <Field label="Chi tiết ẩm / mốc">
              <input value={checklist.wetMoldNote} onChange={(e) => set('wetMoldNote', e.target.value)} />
            </Field>
          ) : null}
        </div>

        <h3>Yêu cầu kỹ thuật</h3>
        <div className="ps-form-grid">
          <Field label="ISO (Push/Pull)">
            <select value={checklist.isoHandling} onChange={(e) => set('isoHandling', e.target.value)}>
              <SelectOptions options={ISO_HANDLING} />
            </select>
          </Field>
          <Field label="ISO gốc / chụp">
            <input
              type="number"
              placeholder="VD: 400"
              value={checklist.isoValue}
              onChange={(e) => set('isoValue', e.target.value)}
            />
          </Field>
          {checklist.isoHandling === 'push' || checklist.isoHandling === 'pull' ? (
            <Field label="Số stop (+/-)">
              <input
                type="number"
                placeholder="VD: 1"
                value={checklist.pushPullStops}
                onChange={(e) => set('pushPullStops', e.target.value)}
              />
            </Field>
          ) : null}
          <Field label="Cắt phim">
            <select value={checklist.cutFilm} onChange={(e) => set('cutFilm', e.target.value)}>
              <SelectOptions options={CUT_FILM} />
            </select>
          </Field>
          <Field label="Định dạng file scan">
            <select
              value={checklist.scanFileFormat}
              onChange={(e) => set('scanFileFormat', e.target.value)}
            >
              <SelectOptions options={SCAN_FORMATS} />
            </select>
          </Field>
          <Field label="Độ phân giải scan">
            <select
              value={checklist.scanResolution}
              onChange={(e) => set('scanResolution', e.target.value)}
            >
              <SelectOptions options={SCAN_RESOLUTIONS} />
            </select>
          </Field>
          <Field label="Tông màu">
            <select value={checklist.colorTone} onChange={(e) => set('colorTone', e.target.value)}>
              <SelectOptions options={COLOR_TONES} />
            </select>
          </Field>
          {checklist.scanResolution === 'custom' ? (
            <Field label="Ghi chú độ phân giải">
              <input
                value={checklist.scanResolutionNote}
                onChange={(e) => set('scanResolutionNote', e.target.value)}
              />
            </Field>
          ) : null}
          {checklist.colorTone === 'custom' ? (
            <Field label="Ghi chú tông màu">
              <input value={checklist.colorToneNote} onChange={(e) => set('colorToneNote', e.target.value)} />
            </Field>
          ) : null}
        </div>
        <Field label="Ghi chú kỹ thuật khác">
          <textarea
            rows={3}
            placeholder="Yêu cầu đặc biệt..."
            value={checklist.technicalNotes}
            onChange={(e) => set('technicalNotes', e.target.value)}
          />
        </Field>

        <h3>Giao nhận</h3>
        <div className="ps-form-grid">
          <Field label="Nhận lại film gốc">
            <select
              value={checklist.originalFilmReturn}
              onChange={(e) => set('originalFilmReturn', e.target.value)}
            >
              <SelectOptions options={ORIGINAL_RETURN} />
            </select>
          </Field>
          {checklist.originalFilmReturn === 'ship_home' ? (
            <Field label="Địa chỉ ship">
              <input
                value={checklist.shippingAddress}
                onChange={(e) => set('shippingAddress', e.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <Field label="Ghi chú cho lab">
          <textarea
            rows={3}
            placeholder="Thời gian gửi, số cuộn thêm..."
            value={receptionNotes}
            onChange={(e) => setReceptionNotes(e.target.value)}
          />
        </Field>

        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? 'Đang gửi...' : 'Gửi đơn tráng'}
        </button>
      </form>
    </section>
  );
}
