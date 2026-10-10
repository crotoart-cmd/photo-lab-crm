import { useState } from 'react';
import publicApi from '../../api/publicClient';
import { Field, Honeypot } from './PublicIntakeFields';

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  model_name: '',
  brand: '',
  serial_number: '',
  symptom: '',
  condition_at_intake: '',
  intake_note: '',
};

export default function PublicRepairIntakeForm() {
  const [form, setForm] = useState(empty);
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    setSaving(true);
    try {
      const { data } = await publicApi.post('/public/repair', { ...form, website });
      setDone(data.message || `Đã nhận phiếu ${data.ticketNumber}`);
      setForm(empty);
    } catch (err) {
      setError(err.response?.data?.message || 'Không gửi được phiếu. Thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="gui-don" className="ps-section">
      <h2>Gửi phiếu sửa máy</h2>
      <p className="ps-form-lead">
        Cùng mục lab dùng khi tiếp nhận máy. Lab kiểm tra rồi gửi báo giá — bạn xác nhận trên email trước khi sửa.
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
            <input required placeholder="Nguyễn" value={form.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="Tên" required>
            <input required placeholder="Văn A" value={form.lastName} onChange={set('lastName')} />
          </Field>
          <Field label="Email" required>
            <input
              required
              type="email"
              placeholder="email@example.com"
              value={form.email}
              onChange={set('email')}
            />
          </Field>
          <Field label="Số điện thoại" required>
            <input
              required
              inputMode="tel"
              placeholder="0901234567"
              value={form.phone}
              onChange={set('phone')}
            />
          </Field>
        </div>

        <h3>Máy</h3>
        <div className="ps-form-grid">
          <Field label="Model máy" required>
            <input required placeholder="VD: Canon AE-1" value={form.model_name} onChange={set('model_name')} />
          </Field>
          <Field label="Hãng">
            <input placeholder="Canon" value={form.brand} onChange={set('brand')} />
          </Field>
          <Field label="Sê-ri">
            <input value={form.serial_number} onChange={set('serial_number')} />
          </Field>
        </div>
        <Field label="Triệu chứng / mô tả lỗi" required>
          <textarea
            required
            rows={4}
            placeholder="Máy kẹt film, màn trập..."
            value={form.symptom}
            onChange={set('symptom')}
          />
        </Field>
        <Field label="Tình trạng lúc gửi">
          <textarea
            rows={3}
            placeholder="Vỏ, ống kính, phụ kiện kèm..."
            value={form.condition_at_intake}
            onChange={set('condition_at_intake')}
          />
        </Field>
        <Field label="Ghi chú thêm">
          <textarea rows={2} value={form.intake_note} onChange={set('intake_note')} />
        </Field>

        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? 'Đang gửi...' : 'Gửi phiếu sửa'}
        </button>
      </form>
    </section>
  );
}
