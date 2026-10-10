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
import { usePublicLocale } from './PublicLocale';
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
  const { t } = usePublicLocale();
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
      setDone(data.message || `${t('form.ok.film')} ${data.ticketNumber || ''}`.trim());
      setCustomer(emptyCustomer);
      setQuantity(1);
      setChecklist(defaultIntakeChecklist());
      setReceptionNotes('');
    } catch (err) {
      setError(err.response?.data?.message || t('form.err.film'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="gui-don" className="ps-section">
      <h2>{t('form.film.h2')}</h2>
      <p className="ps-form-lead">{t('form.film.lead')}</p>
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
            <input
              required
              placeholder={t('form.ph.last')}
              value={customer.firstName}
              onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })}
            />
          </Field>
          <Field label={t('form.first')} required>
            <input
              required
              placeholder={t('form.ph.first')}
              value={customer.lastName}
              onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })}
            />
          </Field>
          <Field label={t('form.email')} required>
            <input
              required
              type="email"
              placeholder="email@example.com"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </Field>
          <Field label={t('form.phone')} required>
            <input
              required
              inputMode="tel"
              placeholder="0901234567"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </Field>
          <Field label={t('form.address')}>
            <input
              placeholder={t('form.ph.address')}
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
            />
          </Field>
          <Field label={t('form.city')}>
            <input
              placeholder={t('form.ph.city')}
              value={customer.city}
              onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
            />
          </Field>
          <Field label={t('form.postal')}>
            <input
              placeholder="100000"
              value={customer.postalCode}
              onChange={(e) => setCustomer({ ...customer, postalCode: e.target.value })}
            />
          </Field>
          <Field label={t('form.film.qty')} required>
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

        <h3>{t('form.film.type')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.film.format')} required>
            <select value={checklist.filmFormat} onChange={(e) => set('filmFormat', e.target.value)}>
              <SelectOptions options={FILM_FORMATS} t={t} group="format" />
            </select>
          </Field>
          {checklist.filmFormat === 'other' ? (
            <Field label={t('form.film.formatNote')}>
              <input
                value={checklist.filmFormatNote}
                onChange={(e) => set('filmFormatNote', e.target.value)}
              />
            </Field>
          ) : null}
          <Field label={t('form.film.kind')} required>
            <select
              value={checklist.filmTypeDetail}
              onChange={(e) => onFilmTypeDetailChange(e.target.value)}
            >
              <SelectOptions options={FILM_TYPE_DETAILS} t={t} group="type" />
            </select>
          </Field>
          <Field label={t('form.film.process')} required>
            <select
              value={checklist.processingProcess}
              onChange={(e) => set('processingProcess', e.target.value)}
            >
              <SelectOptions options={PROCESSING_PROCESSES} t={t} group="process" />
            </select>
          </Field>
          {checklist.processingProcess === 'other' ? (
            <Field label={t('form.film.processNote')}>
              <input
                value={checklist.processingProcessNote}
                onChange={(e) => set('processingProcessNote', e.target.value)}
              />
            </Field>
          ) : null}
        </div>

        <h3>{t('form.film.physical')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.film.leader')} required>
            <select value={checklist.leaderStatus} onChange={(e) => set('leaderStatus', e.target.value)}>
              <SelectOptions options={LEADER_STATUS} t={t} group="leader" />
            </select>
          </Field>
          <Field label={t('form.film.canister')} required>
            <select
              value={checklist.canisterCondition}
              onChange={(e) => set('canisterCondition', e.target.value)}
            >
              <SelectOptions options={CANISTER_CONDITIONS} t={t} group="canister" />
            </select>
          </Field>
          <Field label={t('form.film.stuck')} required>
            <select
              value={checklist.filmStuckBroken}
              onChange={(e) => set('filmStuckBroken', e.target.value)}
            >
              <SelectOptions options={PUBLIC_FILM_STUCK} t={t} group="stuck" />
            </select>
          </Field>
          <Field label={t('form.film.mold')} required>
            <select value={checklist.wetMold} onChange={(e) => set('wetMold', e.target.value)}>
              <SelectOptions options={WET_MOLD} t={t} group="mold" />
            </select>
          </Field>
          {checklist.canisterCondition !== 'ok' ? (
            <Field label={t('form.film.canisterNote')}>
              <input
                value={checklist.canisterConditionNote}
                onChange={(e) => set('canisterConditionNote', e.target.value)}
              />
            </Field>
          ) : null}
          {checklist.filmStuckBroken !== 'no' ? (
            <Field label={t('form.film.stuckNote')}>
              <input
                value={checklist.filmStuckBrokenNote}
                onChange={(e) => set('filmStuckBrokenNote', e.target.value)}
              />
            </Field>
          ) : null}
          {checklist.wetMold !== 'no' ? (
            <Field label={t('form.film.moldNote')}>
              <input value={checklist.wetMoldNote} onChange={(e) => set('wetMoldNote', e.target.value)} />
            </Field>
          ) : null}
        </div>

        <h3>{t('form.film.tech')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.film.iso')}>
            <select value={checklist.isoHandling} onChange={(e) => set('isoHandling', e.target.value)}>
              <SelectOptions options={ISO_HANDLING} t={t} group="iso" />
            </select>
          </Field>
          <Field label={t('form.film.isoVal')}>
            <input
              type="number"
              placeholder={t('form.ph.iso')}
              value={checklist.isoValue}
              onChange={(e) => set('isoValue', e.target.value)}
            />
          </Field>
          {checklist.isoHandling === 'push' || checklist.isoHandling === 'pull' ? (
            <Field label={t('form.film.stops')}>
              <input
                type="number"
                placeholder={t('form.ph.stops')}
                value={checklist.pushPullStops}
                onChange={(e) => set('pushPullStops', e.target.value)}
              />
            </Field>
          ) : null}
          <Field label={t('form.film.cut')}>
            <select value={checklist.cutFilm} onChange={(e) => set('cutFilm', e.target.value)}>
              <SelectOptions options={CUT_FILM} t={t} group="cut" />
            </select>
          </Field>
          <Field label={t('form.film.scanFmt')}>
            <select
              value={checklist.scanFileFormat}
              onChange={(e) => set('scanFileFormat', e.target.value)}
            >
              <SelectOptions options={SCAN_FORMATS} t={t} group="scanFmt" />
            </select>
          </Field>
          <Field label={t('form.film.scanRes')}>
            <select
              value={checklist.scanResolution}
              onChange={(e) => set('scanResolution', e.target.value)}
            >
              <SelectOptions options={SCAN_RESOLUTIONS} t={t} group="scanRes" />
            </select>
          </Field>
          <Field label={t('form.film.tone')}>
            <select value={checklist.colorTone} onChange={(e) => set('colorTone', e.target.value)}>
              <SelectOptions options={COLOR_TONES} t={t} group="tone" />
            </select>
          </Field>
          {checklist.scanResolution === 'custom' ? (
            <Field label={t('form.film.scanResNote')}>
              <input
                value={checklist.scanResolutionNote}
                onChange={(e) => set('scanResolutionNote', e.target.value)}
              />
            </Field>
          ) : null}
          {checklist.colorTone === 'custom' ? (
            <Field label={t('form.film.toneNote')}>
              <input value={checklist.colorToneNote} onChange={(e) => set('colorToneNote', e.target.value)} />
            </Field>
          ) : null}
        </div>
        <Field label={t('form.film.techNote')}>
          <textarea
            rows={3}
            placeholder={t('form.ph.tech')}
            value={checklist.technicalNotes}
            onChange={(e) => set('technicalNotes', e.target.value)}
          />
        </Field>

        <h3>{t('form.film.handoff')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.film.original')}>
            <select
              value={checklist.originalFilmReturn}
              onChange={(e) => set('originalFilmReturn', e.target.value)}
            >
              <SelectOptions options={ORIGINAL_RETURN} t={t} group="return" />
            </select>
          </Field>
          {checklist.originalFilmReturn === 'ship_home' ? (
            <Field label={t('form.film.ship')}>
              <input
                value={checklist.shippingAddress}
                onChange={(e) => set('shippingAddress', e.target.value)}
              />
            </Field>
          ) : null}
        </div>
        <Field label={t('form.film.labNote')}>
          <textarea
            rows={3}
            placeholder={t('form.ph.labNotes')}
            value={receptionNotes}
            onChange={(e) => setReceptionNotes(e.target.value)}
          />
        </Field>

        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? t('form.sending') : t('form.film.submit')}
        </button>
      </form>
    </section>
  );
}
