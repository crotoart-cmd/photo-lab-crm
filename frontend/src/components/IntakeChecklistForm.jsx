import { useState } from 'react';
import api from '../api/client';
import CustomerSearchPicker from './CustomerSearchPicker';
import AppleSegmentedControl from './AppleSegmentedControl';
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
  defaultIntakeChecklist,
  filmTypeFromDetail,
} from '../utils/intakeOptions';
import { LabeledInput, LabeledTextarea, LabeledSelect } from './formFields';
import '../styles/intake-checklist-ios.css';

function FormSection({ title, caption, children }) {
  return (
    <section className="ios-form-section">
      <div className="ios-form-section__header">
        <h3 className="ios-form-section__title">{title}</h3>
        {caption ? <span className="ios-form-section__caption">{caption}</span> : null}
      </div>
      <div className="ios-form-group">
        <div className="ios-form-group__body">{children}</div>
      </div>
    </section>
  );
}

function FormDisclosure({ title, caption, children, defaultOpen = false }) {
  return (
    <details className="ios-form-disclosure" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        {caption ? <span className="ios-form-section__caption">{caption}</span> : null}
      </summary>
      <div className="ios-form-disclosure__content">{children}</div>
    </details>
  );
}

function SelectOptions({ options }) {
  return options.map((o) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  ));
}

export { defaultIntakeChecklist };

const newCustomerEmptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  notes: '',
};

const CUSTOMER_MODE_ITEMS = [
  { id: 'existing', label: 'Khách cũ' },
  { id: 'new', label: 'Thêm mới' },
];

export default function IntakeChecklistForm({
  checklist,
  onChange,
  customers,
  customerId,
  onCustomerChange,
}) {
  const set = (key, value) => onChange({ [key]: value });
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomerForm, setNewCustomerForm] = useState(newCustomerEmptyForm);
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState('');
  const [newCustomerSuccess, setNewCustomerSuccess] = useState('');
  const [pickedCustomer, setPickedCustomer] = useState(null);
  const selectedCustomer =
    pickedCustomer || customers.find((x) => x._id === customerId) || null;

  const applyCustomer = (c) => {
    if (!c) {
      setPickedCustomer(null);
      onCustomerChange('', {
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        contactVerified: false,
      });
      return;
    }
    setPickedCustomer(c);
    onCustomerChange(
      c._id,
      {
        contactName: `${c.firstName} ${c.lastName}`.trim(),
        contactPhone: c.phone || '',
        contactEmail: c.email || '',
        contactVerified: true,
      },
      c
    );
  };

  const handleCreateCustomer = async () => {
    setNewCustomerError('');
    setNewCustomerSuccess('');
    setNewCustomerLoading(true);
    try {
      const { data } = await api.post('/customers', newCustomerForm);
      const created = data.customer;
      applyCustomer(created);
      setNewCustomerSuccess('Lưu khách hàng thành công.');
      setNewCustomerForm(newCustomerEmptyForm);
      setCustomerMode('existing');
    } catch (err) {
      setNewCustomerError(err.response?.data?.message || 'Lưu khách hàng thất bại');
    } finally {
      setNewCustomerLoading(false);
    }
  };

  const onFilmTypeDetailChange = (detail) => {
    const processMap = {
      color_negative: 'c41',
      black_white: 'bw_standard',
      slide_e6: 'e6',
    };
    onChange({
      filmTypeDetail: detail,
      processingProcess: processMap[detail] || checklist.processingProcess,
    });
  };

  return (
    <div className="intake-checklist-form">
      <FormSection title="Khách hàng" caption="Bắt buộc">
        <AppleSegmentedControl
          items={CUSTOMER_MODE_ITEMS}
          value={customerMode}
          onChange={(id) => {
            setCustomerMode(id);
            if (id === 'new') {
              setNewCustomerError('');
              setNewCustomerSuccess('');
            }
          }}
        />

        {customerMode === 'existing' ? (
          <CustomerSearchPicker
            customerId={customerId}
            selectedCustomer={selectedCustomer}
            onSelect={applyCustomer}
            onClear={() => applyCustomer(null)}
          />
        ) : (
          <div className="ios-form-group__body" style={{ padding: 0, gap: '0.75rem' }}>
            {newCustomerError ? (
              <p className="ios-form-banner ios-form-banner--error">{newCustomerError}</p>
            ) : null}
            {newCustomerSuccess ? (
              <p className="ios-form-banner ios-form-banner--success">{newCustomerSuccess}</p>
            ) : null}
            <div className="ios-form-grid ios-form-grid--2">
              <LabeledInput
                label="Họ"
                required
                placeholder="Nguyễn"
                value={newCustomerForm.firstName}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, firstName: e.target.value })}
              />
              <LabeledInput
                label="Tên"
                required
                placeholder="Văn A"
                value={newCustomerForm.lastName}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, lastName: e.target.value })}
              />
            </div>
            <LabeledInput
              label="Email"
              required
              type="email"
              placeholder="email@example.com"
              value={newCustomerForm.email}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
            />
            <LabeledInput
              label="Số điện thoại"
              required
              placeholder="0901234567"
              value={newCustomerForm.phone}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
            />
            <LabeledInput
              label="Địa chỉ"
              placeholder="Số nhà, đường..."
              value={newCustomerForm.address}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, address: e.target.value })}
            />
            <div className="ios-form-grid ios-form-grid--2">
              <LabeledInput
                label="Thành phố"
                placeholder="Hà Nội"
                value={newCustomerForm.city}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, city: e.target.value })}
              />
              <LabeledInput
                label="Mã bưu điện"
                placeholder="100000"
                value={newCustomerForm.postalCode}
                onChange={(e) => setNewCustomerForm({ ...newCustomerForm, postalCode: e.target.value })}
              />
            </div>
            <LabeledTextarea
              label="Ghi chú"
              rows={2}
              placeholder="Ghi chú về khách..."
              value={newCustomerForm.notes}
              onChange={(e) => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
            />
            <button
              type="button"
              onClick={handleCreateCustomer}
              disabled={newCustomerLoading}
              className="apple-btn-primary w-full"
            >
              {newCustomerLoading ? 'Đang lưu...' : 'Lưu khách hàng'}
            </button>
          </div>
        )}

        {customerId ? (
          <p className="ios-form-banner ios-form-banner--success">
            Đã chọn khách — mục liên lạc đã điền tự động. Kiểm tra lại trước khi gửi.
          </p>
        ) : null}

        <LabeledInput
          label="Số cuộn film giao"
          required
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="VD: 1"
          value={checklist.quantity ?? 1}
          onChange={(e) => set('quantity', Number(e.target.value))}
        />
      </FormSection>

      <FormSection title="Loại phim" caption="Kiểm tra vỏ & lõi">
        <div className="ios-form-grid ios-form-grid--2">
          <LabeledSelect
            label="Khổ phim"
            required
            value={checklist.filmFormat}
            onChange={(e) => set('filmFormat', e.target.value)}
          >
            <SelectOptions options={FILM_FORMATS} />
          </LabeledSelect>
          {checklist.filmFormat === 'other' ? (
            <LabeledInput
              label="Ghi chú khổ phim"
              placeholder="Mô tả khổ khác..."
              value={checklist.filmFormatNote}
              onChange={(e) => set('filmFormatNote', e.target.value)}
            />
          ) : null}
          <LabeledSelect
            label="Loại phim"
            required
            value={checklist.filmTypeDetail}
            onChange={(e) => onFilmTypeDetailChange(e.target.value)}
          >
            <SelectOptions options={FILM_TYPE_DETAILS} />
          </LabeledSelect>
          <LabeledSelect
            label="Quy trình tráng"
            required
            value={checklist.processingProcess}
            onChange={(e) => set('processingProcess', e.target.value)}
          >
            <SelectOptions options={PROCESSING_PROCESSES} />
          </LabeledSelect>
        </div>
        {checklist.processingProcess === 'other' ? (
          <LabeledInput
            label="Ghi chú quy trình"
            placeholder="Mô tả quy trình khác..."
            value={checklist.processingProcessNote}
            onChange={(e) => set('processingProcessNote', e.target.value)}
          />
        ) : null}
        <p className="ios-form-footnote">
          Hệ thống: {filmTypeFromDetail(checklist.filmTypeDetail)} · {checklist.quantity || 1} cuộn
        </p>
      </FormSection>

      <FormDisclosure title="Tình trạng vật lý" caption="Tránh tranh chấp">
        <div className="ios-form-grid ios-form-grid--2">
          <LabeledSelect
            label="Đầu phim (Leader)"
            required
            value={checklist.leaderStatus}
            onChange={(e) => set('leaderStatus', e.target.value)}
          >
            <SelectOptions options={LEADER_STATUS} />
          </LabeledSelect>
          <LabeledSelect
            label="Tình trạng vỏ"
            required
            value={checklist.canisterCondition}
            onChange={(e) => set('canisterCondition', e.target.value)}
          >
            <SelectOptions options={CANISTER_CONDITIONS} />
          </LabeledSelect>
          <LabeledSelect
            label="Phim kẹt / đứt"
            required
            value={checklist.filmStuckBroken}
            onChange={(e) => set('filmStuckBroken', e.target.value)}
          >
            <SelectOptions options={FILM_STUCK} />
          </LabeledSelect>
          <LabeledSelect
            label="Phim ướt / mốc"
            required
            value={checklist.wetMold}
            onChange={(e) => set('wetMold', e.target.value)}
          >
            <SelectOptions options={WET_MOLD} />
          </LabeledSelect>
        </div>
        {(checklist.canisterCondition !== 'ok' ||
          checklist.filmStuckBroken !== 'no' ||
          checklist.wetMold !== 'no') && (
          <div className="ios-form-callout">
            {checklist.canisterCondition !== 'ok' && (
              <LabeledInput
                label="Chi tiết tình trạng vỏ"
                placeholder="Mô tả vỏ hộp..."
                value={checklist.canisterConditionNote}
                onChange={(e) => set('canisterConditionNote', e.target.value)}
              />
            )}
            {checklist.filmStuckBroken !== 'no' && (
              <LabeledInput
                label="Chi tiết kẹt / đứt"
                placeholder="Mô tả kẹt film..."
                value={checklist.filmStuckBrokenNote}
                onChange={(e) => set('filmStuckBrokenNote', e.target.value)}
              />
            )}
            {checklist.wetMold !== 'no' && (
              <LabeledInput
                label="Chi tiết ẩm / mốc"
                placeholder="Mô tả ẩm mốc..."
                value={checklist.wetMoldNote}
                onChange={(e) => set('wetMoldNote', e.target.value)}
              />
            )}
          </div>
        )}
      </FormDisclosure>

      <FormDisclosure title="Yêu cầu kỹ thuật" caption="Develop & scan">
        <div className="ios-form-grid ios-form-grid--2">
          <LabeledSelect
            label="ISO (Push/Pull)"
            value={checklist.isoHandling}
            onChange={(e) => set('isoHandling', e.target.value)}
          >
            <SelectOptions options={ISO_HANDLING} />
          </LabeledSelect>
          <LabeledInput
            label="ISO gốc / chụp"
            type="number"
            placeholder="VD: 400"
            value={checklist.isoValue}
            onChange={(e) => set('isoValue', e.target.value)}
          />
          {(checklist.isoHandling === 'push' || checklist.isoHandling === 'pull') && (
            <LabeledInput
              label="Số stop (+/-)"
              type="number"
              placeholder="VD: 1"
              value={checklist.pushPullStops}
              onChange={(e) => set('pushPullStops', e.target.value)}
            />
          )}
          <LabeledSelect
            label="Cắt phim"
            value={checklist.cutFilm}
            onChange={(e) => set('cutFilm', e.target.value)}
          >
            <SelectOptions options={CUT_FILM} />
          </LabeledSelect>
          <LabeledSelect
            label="Định dạng file scan"
            value={checklist.scanFileFormat}
            onChange={(e) => set('scanFileFormat', e.target.value)}
          >
            <SelectOptions options={SCAN_FORMATS} />
          </LabeledSelect>
          <LabeledSelect
            label="Độ phân giải scan"
            value={checklist.scanResolution}
            onChange={(e) => set('scanResolution', e.target.value)}
          >
            <SelectOptions options={SCAN_RESOLUTIONS} />
          </LabeledSelect>
          <LabeledSelect
            label="Tông màu"
            value={checklist.colorTone}
            onChange={(e) => set('colorTone', e.target.value)}
          >
            <SelectOptions options={COLOR_TONES} />
          </LabeledSelect>
        </div>
        {(checklist.scanResolution === 'custom' || checklist.colorTone === 'custom') && (
          <div className="ios-form-grid ios-form-grid--2">
            {checklist.scanResolution === 'custom' && (
              <LabeledInput
                label="Ghi chú độ phân giải"
                placeholder="VD: 6000 DPI..."
                value={checklist.scanResolutionNote}
                onChange={(e) => set('scanResolutionNote', e.target.value)}
              />
            )}
            {checklist.colorTone === 'custom' && (
              <LabeledInput
                label="Ghi chú tông màu"
                placeholder="VD: tông ấm..."
                value={checklist.colorToneNote}
                onChange={(e) => set('colorToneNote', e.target.value)}
              />
            )}
          </div>
        )}
        <LabeledTextarea
          label="Ghi chú kỹ thuật khác"
          rows={2}
          placeholder="Yêu cầu đặc biệt..."
          value={checklist.technicalNotes}
          onChange={(e) => set('technicalNotes', e.target.value)}
        />
      </FormDisclosure>

      <FormSection title="Giao nhận & thanh toán" caption="Hoàn tất thủ tục">
        <label className="ios-form-check-row">
          <input
            type="checkbox"
            checked={checklist.contactVerified}
            onChange={(e) => set('contactVerified', e.target.checked)}
          />
          <span>Đã xác nhận thông tin liên lạc chính xác (email nhận link scan)</span>
        </label>
        <div className="ios-form-grid ios-form-grid--3">
          <LabeledInput
            label="Họ tên"
            placeholder="Nguyễn Văn A"
            value={checklist.contactName}
            onChange={(e) => set('contactName', e.target.value)}
          />
          <LabeledInput
            label="Số điện thoại"
            placeholder="0901234567"
            value={checklist.contactPhone}
            onChange={(e) => set('contactPhone', e.target.value)}
          />
          <LabeledInput
            label="Email"
            type="email"
            placeholder="email@example.com"
            value={checklist.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
          />
        </div>
        <LabeledInput
          label="Hẹn trả bài"
          type="datetime-local"
          value={checklist.promisedReturnAt}
          onChange={(e) => set('promisedReturnAt', e.target.value)}
        />
        <div className="ios-form-grid ios-form-grid--2">
          <LabeledSelect
            label="Nhận lại film gốc"
            value={checklist.originalFilmReturn}
            onChange={(e) => set('originalFilmReturn', e.target.value)}
          >
            <SelectOptions options={ORIGINAL_RETURN} />
          </LabeledSelect>
          <LabeledSelect
            label="Thanh toán"
            required
            value={checklist.paymentStatus}
            onChange={(e) => set('paymentStatus', e.target.value)}
          >
            <SelectOptions options={PAYMENT_STATUS} />
          </LabeledSelect>
        </div>
        {checklist.originalFilmReturn === 'ship_home' && (
          <LabeledInput
            label="Địa chỉ ship"
            placeholder="Số nhà, đường, quận..."
            value={checklist.shippingAddress}
            onChange={(e) => set('shippingAddress', e.target.value)}
          />
        )}
        <div className="ios-form-grid ios-form-grid--2">
          <LabeledInput
            label="Số tiền (VNĐ)"
            type="number"
            placeholder="VD: 150000"
            value={checklist.paymentAmount}
            onChange={(e) => set('paymentAmount', e.target.value)}
          />
          <LabeledInput
            label="Nhân viên kiểm tra"
            placeholder="Tên nhân viên lab"
            value={checklist.inspectedBy}
            onChange={(e) => set('inspectedBy', e.target.value)}
          />
        </div>
        <LabeledTextarea
          label="Ghi chú thanh toán / giao nhận"
          rows={2}
          placeholder="Ghi chú thêm..."
          value={checklist.paymentNote}
          onChange={(e) => set('paymentNote', e.target.value)}
        />
      </FormSection>
    </div>
  );
}
