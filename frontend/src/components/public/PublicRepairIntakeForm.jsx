import { useState } from 'react';
import publicApi from '../../api/publicClient';
import { usePublicLocale } from './PublicLocale';
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
  const { t } = usePublicLocale();
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
      setDone(data.message || `${t('form.ok.repair')} ${data.ticketNumber || ''}`.trim());
      setForm(empty);
    } catch (err) {
      setError(err.response?.data?.message || t('form.err.repair'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="gui-don" className="ps-section">
      <h2>{t('form.repair.h2')}</h2>
      <p className="ps-form-lead">{t('form.repair.lead')}</p>
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

        <h3>{t('form.customer')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.last')} required>
            <input required placeholder={t('form.ph.last')} value={form.firstName} onChange={set('firstName')} />
          </Field>
          <Field label={t('form.first')} required>
            <input required placeholder={t('form.ph.first')} value={form.lastName} onChange={set('lastName')} />
          </Field>
          <Field label={t('form.email')} required>
            <input
              required
              type="email"
              placeholder="email@example.com"
              value={form.email}
              onChange={set('email')}
            />
          </Field>
          <Field label={t('form.phone')} required>
            <input
              required
              inputMode="tel"
              placeholder="0901234567"
              value={form.phone}
              onChange={set('phone')}
            />
          </Field>
        </div>

        <h3>{t('form.repair.cam')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.repair.model')} required>
            <input required placeholder={t('form.ph.model')} value={form.model_name} onChange={set('model_name')} />
          </Field>
          <Field label={t('form.repair.brand')}>
            <input placeholder="Canon" value={form.brand} onChange={set('brand')} />
          </Field>
          <Field label={t('form.repair.serial')}>
            <input value={form.serial_number} onChange={set('serial_number')} />
          </Field>
        </div>
        <Field label={t('form.repair.symptom')} required>
          <textarea
            required
            rows={4}
            placeholder={t('form.ph.symptom')}
            value={form.symptom}
            onChange={set('symptom')}
          />
        </Field>
        <Field label={t('form.repair.condition')}>
          <textarea
            rows={3}
            placeholder={t('form.ph.condition')}
            value={form.condition_at_intake}
            onChange={set('condition_at_intake')}
          />
        </Field>
        <Field label={t('form.repair.note')}>
          <textarea rows={2} value={form.intake_note} onChange={set('intake_note')} />
        </Field>

        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? t('form.sending') : t('form.repair.submit')}
        </button>
      </form>
    </section>
  );
}
