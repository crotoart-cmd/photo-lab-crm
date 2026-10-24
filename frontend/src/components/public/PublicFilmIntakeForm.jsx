import { useEffect, useRef, useState } from 'react';
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
import PublicCaptcha, { captchaFields } from './PublicCaptcha';
import { PublicMobileChips } from './PublicMobilePage';
import { pingWebInbox } from '../../lib/webInboxPing';
import PublicMobileIcon from './PublicMobileIcon';

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

export default function PublicFilmIntakeForm({ compact = false }) {
  const { t } = usePublicLocale();
  const [customer, setCustomer] = useState(emptyCustomer);
  const [quantity, setQuantity] = useState(1);
  const [checklist, setChecklist] = useState(() => defaultIntakeChecklist());
  const [receptionNotes, setReceptionNotes] = useState('');
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [step, setStep] = useState(1);
  const mobileForm = useRef(null);
  const captchaRef = useRef(null);
  const mobileStepTitle = useRef(null);
  const mobileStatus = useRef(null);
  const previousStep = useRef(step);

  useEffect(() => {
    if (compact && previousStep.current !== step) mobileStepTitle.current?.focus();
    previousStep.current = step;
  }, [compact, step]);

  useEffect(() => {
    if (compact && done) mobileStatus.current?.focus();
  }, [compact, done]);

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
        ...captchaFields(captchaRef),
      });
      pingWebInbox();
      setDone(data.message || `${t('form.ok.film')} ${data.ticketNumber || ''}`.trim());
      setCustomer(emptyCustomer);
      setQuantity(1);
      setChecklist(defaultIntakeChecklist());
      setReceptionNotes('');
      setStep(1);
    } catch (err) {
      captchaRef.current?.reload();
      setError(err.response?.data?.message || t('form.err.film'));
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step === 2) {
      if (!mobileForm.current?.reportValidity()) return;
      const ok = [customer.firstName, customer.lastName, customer.email, customer.phone].every((v) =>
        String(v || '').trim()
      );
      if (!ok) {
        setError(t('mpage.need'));
        [...mobileForm.current.querySelectorAll('input[required]')].find((input) => !input.value.trim())?.focus();
        return;
      }
    }
    setError('');
    setStep((s) => Math.min(3, s + 1));
  };

  if (compact) {
    const steps = ['exp.filmStep', 'mpage.contactStep', 'exp.reviewStep'];
    const kinds = [
      { value: 'color_negative', label: 'C-41' },
      { value: 'black_white', label: 'B&W' },
      { value: 'slide_e6', label: 'E-6' },
    ];
    const formats = [
      { value: '35mm', label: '135', hint: '35mm' },
      { value: '120', label: '120', hint: t('exp.mediumFormat') },
    ];
    const scans = SCAN_RESOLUTIONS.filter((o) => o.value !== 'custom').map((o) => ({
      value: o.value,
      label: t(`opt.scanRes.${o.value}`),
      hint: t(`exp.scan.${o.value}`),
    }));
    const returns = [
      { value: 'pickup_at_lab', label: t('mpage.ret.lab') },
      { value: 'ship_home', label: t('mpage.ret.ship') },
      { value: 'discard', label: t('mpage.ret.drop') },
    ];
    return (
      <section className="ps-mform pm-film-form" id="mobile-film-intake" aria-labelledby="mobile-film-title">
        <h2 className="ps-msection-title" id="mobile-film-title">{t('form.film.h2')}</h2>
        {error ? <p className="ps-mform-err" role="alert">{error}</p> : null}
        {done ? <p ref={mobileStatus} tabIndex={-1} className="ps-mform-ok" role="status">{done}</p> : null}
        <form
          ref={mobileForm}
          aria-busy={saving}
          onSubmit={(e) => {
            if (saving) {
              e.preventDefault();
              return;
            }
            if (step < 3) {
              e.preventDefault();
              goNext();
              return;
            }
            if (checklist.originalFilmReturn === 'ship_home' && !String(checklist.shippingAddress || customer.address || '').trim()) {
              e.preventDefault();
              setError(t('mpage.need'));
              return;
            }
            handleSubmit(e);
          }}
        >
          <Honeypot />
          <input
            className="ps-hp"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <ol className="ps-mprogress" aria-label={t('form.film.h2')}>
            {steps.map((key, index) => (
              <li key={key} className={step >= index + 1 ? 'is-on' : ''} aria-current={step === index + 1 ? 'step' : undefined}>
                <span>{String(index + 1).padStart(2, '0')}</span>{t(key)}
              </li>
            ))}
          </ol>
          <h3 className="ps-mstep-title" key={step} ref={mobileStepTitle} tabIndex={-1}>{t(steps[step - 1])}</h3>
          {step === 2 ? (
            <>
              <div className="ps-mpro-group">
                <Field label={t('form.last')} required>
                  <input
                    required
                    placeholder={t('form.ph.last')}
                    value={customer.firstName}
                    onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })}
                    autoComplete="family-name"
                  />
                </Field>
                <Field label={t('form.first')} required>
                  <input
                    required
                    placeholder={t('form.ph.first')}
                    value={customer.lastName}
                    onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })}
                    autoComplete="given-name"
                  />
                </Field>
                <Field label={t('form.email')} required>
                  <input
                    required
                    type="email"
                    placeholder="email@example.com"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    autoComplete="email"
                  />
                </Field>
                <Field label={t('form.phone')} required>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    placeholder="0901234567"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    autoComplete="tel"
                  />
                </Field>
              </div>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <div className="ps-mpro-group">
                <div className="ps-mqty">
                  <b>{t('mpage.qty')}</b>
                  <div className="ps-mqty-ctrl">
                    <button
                      type="button"
                      aria-label={t('mpage.less')}
                      disabled={quantity <= 1}
                      onClick={() => setQuantity((n) => Math.max(1, n - 1))}
                    >
                      −
                    </button>
                    <output aria-live="polite">{quantity}</output>
                    <button
                      type="button"
                      aria-label={t('mpage.add')}
                      disabled={quantity >= 20}
                      onClick={() => setQuantity((n) => Math.min(20, n + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <p className="ps-msection-h" id="m-kind">
                {t('mpage.kind')}
              </p>
              <div className="ps-mpro-group ps-mpro-group--pad">
                <PublicMobileChips
                  labelledBy="m-kind"
                  value={checklist.filmTypeDetail}
                  onChange={onFilmTypeDetailChange}
                  options={kinds}
                />
              </div>
              <p className="ps-msection-h" id="m-fmt">
                {t('mpage.format')}
              </p>
              <div className="ps-mpro-group ps-mpro-group--pad">
                <PublicMobileChips
                  labelledBy="m-fmt"
                  value={checklist.filmFormat}
                  onChange={(v) => set('filmFormat', v)}
                  options={formats}
                />
              </div>
              <p className="ps-msection-h" id="m-scan">
                {t('mpage.scan')}
              </p>
              <div className="ps-mpro-group ps-mpro-group--pad">
                <PublicMobileChips
                  labelledBy="m-scan"
                  value={checklist.scanResolution}
                  onChange={(v) => set('scanResolution', v)}
                  options={scans}
                />
              </div>
              <p className="ps-msection-h" id="m-file-format">{t('exp.fileFormat')}</p>
              <PublicMobileChips labelledBy="m-file-format" value={checklist.scanFileFormat} onChange={(value) => set('scanFileFormat', value)} options={SCAN_FORMATS.map((option) => ({ value: option.value, label: option.value === 'both' ? 'JPEG + TIFF' : option.value.toUpperCase() }))} />
            </>
          ) : null}
          {step === 3 ? (
            <>
              <div className="pm-order-review">
                <div className="pm-order-review-title"><b>{quantity} × {checklist.filmFormat} / {kinds.find((item) => item.value === checklist.filmTypeDetail)?.label}</b><button type="button" className="pm-icon-button" aria-label={t('exp.editFilm')} title={t('exp.editFilm')} onClick={() => setStep(1)} disabled={saving}><PublicMobileIcon name="edit" /></button></div>
                <p>{scans.find((item) => item.value === checklist.scanResolution)?.label} · {checklist.scanFileFormat.toUpperCase()}</p>
                <div className="pm-order-customer"><b>{customer.firstName} {customer.lastName}</b><span>{customer.email}</span><span>{customer.phone}</span></div>
              </div>
              <p className="ps-msection-h" id="m-ret">
                {t('form.film.original')}
              </p>
              <div className="ps-mpro-group ps-mpro-group--pad">
                <PublicMobileChips
                  labelledBy="m-ret"
                  value={checklist.originalFilmReturn}
                  onChange={(v) => set('originalFilmReturn', v)}
                  options={returns}
                />
              </div>
              {checklist.originalFilmReturn === 'ship_home' ? (
                <div className="ps-mpro-group">
                  <Field label={t('form.address')} required>
                    <input
                      required
                      placeholder={t('form.ph.address')}
                      value={checklist.shippingAddress}
                      onChange={(e) => set('shippingAddress', e.target.value)}
                      autoComplete="street-address"
                    />
                  </Field>
                </div>
              ) : null}
              <div className="ps-mpro-group">
                <Field label={t('form.film.labNote')}>
                  <textarea
                    rows={3}
                    placeholder={t('form.ph.labNotes')}
                    value={receptionNotes}
                    onChange={(e) => setReceptionNotes(e.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : null}
          {step === 3 ? <PublicCaptcha ref={captchaRef} /> : null}
          <div className="ps-mform-nav">
            {step > 1 ? (
              <button
                type="button"
                disabled={saving}
                className="ps-mcta ps-mcta--ghost"
                onClick={() => {
                  setError('');
                  setStep((s) => s - 1);
                }}
              >
                {t('mpage.prev')}
              </button>
            ) : null}
            {step < 3 ? (
              <button key="next-step" type="button" className="ps-mcta ps-mcta--fill" onClick={goNext}>
                {t('mpage.next')}
              </button>
            ) : (
              <button key="send-order" type="submit" className="ps-mcta ps-mcta--fill" disabled={saving}>
                {saving ? t('form.sending') : t('mpage.send')}
              </button>
            )}
          </div>
        </form>
      </section>
    );
  }

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

        <PublicCaptcha ref={captchaRef} />
        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? t('form.sending') : t('form.film.submit')}
        </button>
      </form>
    </section>
  );
}
