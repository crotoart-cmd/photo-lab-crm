import { useEffect, useRef, useState } from 'react';
import publicApi from '../../api/publicClient';
import { getApiBaseUrl, needsServerUrlSetup } from '../../config/apiBase';
import { buildRepairSubmission, repairMediaIssue, repairUploadProgress } from '../../lib/repairMedia';
import { repairMediaT } from '../../lib/repairMediaI18n';
import { usePublicLocale } from './PublicLocale';
import { Field, Honeypot } from './PublicIntakeFields';
import { pingWebInbox } from '../../lib/webInboxPing';
import PublicMobileRepairIntake from './PublicMobileRepairIntake';
import RepairMediaPicker, { RepairMediaAcknowledgment, RepairUploadStatus } from './RepairMediaPicker';

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

export default function PublicRepairIntakeForm({ compact = false }) {
  const { t, lang } = usePublicLocale();
  const [form, setForm] = useState(empty);
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [files, setFiles] = useState([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [progress, setProgress] = useState(null);
  const submitting = useRef(false);
  const uploadController = useRef(null);

  useEffect(() => () => uploadController.current?.abort(), []);

  const changeFiles = (next) => {
    setFiles(next);
    setAcknowledged(false);
    setError('');
  };
  const reset = () => {
    setForm(empty);
    setWebsite('');
    setFiles([]);
    setAcknowledged(false);
    setDone('');
    setError('');
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e, payload = form) => {
    e.preventDefault();
    if (submitting.current) return;
    const issue = repairMediaIssue(files) || (files.length && !acknowledged ? 'acknowledgment' : null);
    if (issue) { setError(repairMediaT(lang, `error.${issue}`)); return; }
    if (files.length && (navigator.onLine === false || (needsServerUrlSetup() && getApiBaseUrl() === '/api'))) {
      setError(repairMediaT(lang, 'connected'));
      return;
    }
    submitting.current = true;
    setError('');
    setDone('');
    setSaving(true);
    setProgress(null);
    const controller = new AbortController();
    uploadController.current = controller;
    try {
      const body = buildRepairSubmission({ ...payload, website }, files, acknowledged);
      const { data } = await publicApi.post('/public/repair', body, {
        signal: controller.signal,
        timeout: files.length ? 180000 : 30000,
        onUploadProgress: files.length ? (event) => setProgress(repairUploadProgress(event)) : undefined,
      });
      pingWebInbox();
      setDone(data.message || `${t('form.ok.repair')} ${data.ticketNumber || ''}`.trim());
      setForm(empty);
      setWebsite('');
      setFiles([]);
      setAcknowledged(false);
    } catch (err) {
      setError(err.code === 'ERR_CANCELED' ? repairMediaT(lang, 'canceled')
        : ['ECONNABORTED', 'ETIMEDOUT'].includes(err.code) ? repairMediaT(lang, 'timeout')
          : err.response?.data?.message || (files.length && !err.response ? repairMediaT(lang, 'connected') : t('form.err.repair')));
    } finally {
      uploadController.current = null;
      submitting.current = false;
      setSaving(false);
    }
  };

  if (compact) {
    return <PublicMobileRepairIntake form={form} setForm={setForm} website={website} setWebsite={setWebsite} saving={saving} error={error} done={done} onSubmit={handleSubmit} clearError={() => setError('')} onReset={reset}
      mediaFiles={files} onMediaChange={changeFiles} mediaAcknowledged={acknowledged} onMediaAcknowledged={setAcknowledged} uploadProgress={progress} onCancelUpload={() => uploadController.current?.abort()} />;
  }

  return (
    <section id="gui-don" className="ps-section">
      <h2>{t('form.repair.h2')}</h2>
      <p className="ps-form-lead">{t('form.repair.lead')}</p>
      {error ? <p className="ps-form-banner ps-form-banner--error" role="alert">{error}</p> : null}
      {done ? <p className="ps-form-banner ps-form-banner--ok" role="status">{done}</p> : null}
      <form className="ps-form ps-repair-media-form" onSubmit={handleSubmit} aria-busy={saving}>
        <fieldset className="repair-media-fields" disabled={saving}>
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
        <RepairMediaPicker files={files} onChange={changeFiles} lang={lang} disabled={saving} />
        <Field label={t('form.repair.note')}>
          <textarea rows={2} value={form.intake_note} onChange={set('intake_note')} />
        </Field>

        <RepairMediaAcknowledgment files={files} acknowledged={acknowledged} onChange={setAcknowledged} lang={lang} disabled={saving} />
        </fieldset>
        <RepairUploadStatus saving={saving} hasMedia={files.length > 0} progress={progress} lang={lang} onCancel={() => uploadController.current?.abort()} />

        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? t('form.sending') : t('form.repair.submit')}
        </button>
      </form>
    </section>
  );
}
