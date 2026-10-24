import { useEffect, useRef, useState } from 'react';
import publicApi from '../../api/publicClient';
import {
  SCAN_DELIVERY,
  SCAN_FORMATS,
  SCAN_METHODS,
  SCAN_OUTPUTS,
  SCAN_SIZES,
  SCAN_SOURCES,
  applyScanMethod,
  emptyScanOrder,
} from '../../data/scanOrderOptions';
import { pingWebInbox } from '../../lib/webInboxPing';
import { Field, Honeypot } from './PublicIntakeFields';
import PublicCaptcha, { captchaFields } from './PublicCaptcha';
import PublicMobileIcon from './PublicMobileIcon';
import { PublicMobileChips } from './PublicMobilePage';
import { usePublicLocale } from './PublicLocale';

const emptyCustomer = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

function chipOptions(values, t) {
  return values.map((value) => ({ value, label: t(`opt.scan.${value}`) }));
}

export default function PublicScanIntakeForm({ compact = false }) {
  const { t } = usePublicLocale();
  const [customer, setCustomer] = useState(emptyCustomer);
  const [order, setOrder] = useState(emptyScanOrder);
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

  const setOrderField = (key, value) => setOrder((prev) => ({ ...prev, [key]: value }));
  const setMethod = (method) => setOrder((prev) => applyScanMethod(prev, method));

  const jobValid = () => {
    if (order.source === 'lab_roll' && !String(order.ticketRef || '').trim()) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    setSaving(true);
    try {
      const { data } = await publicApi.post('/public/scan', {
        ...customer,
        website,
        ...order,
        ...captchaFields(captchaRef),
      });
      pingWebInbox();
      setDone(data.message || `${t('form.ok.scan')} ${data.code || ''}`.trim());
      setCustomer(emptyCustomer);
      setOrder(emptyScanOrder);
      setStep(1);
    } catch (err) {
      captchaRef.current?.reload();
      setError(err.response?.data?.message || t('form.err.scan'));
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step === 1 && !jobValid()) {
      setError(t('mpage.need'));
      return;
    }
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

  const sizeLabel = order.method === 'hiend' ? t('opt.scan.hiendSize') : t(`opt.scan.${order.scanSize}`);
  const methodLabel = t(`opt.scan.${order.method}`);

  const jobFields = (
    <>
      <p className="ps-msection-h" id="s-method">
        {t('form.scan.method')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips
          labelledBy="s-method"
          value={order.method}
          onChange={setMethod}
          options={SCAN_METHODS.map((item) => ({
            value: item.value,
            label: t(`opt.scan.${item.value}`),
            hint: t(item.hintKey),
          }))}
        />
      </div>
      <p className="ps-msection-h" id="s-source">
        {t('form.scan.source')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips labelledBy="s-source" value={order.source} onChange={(v) => setOrderField('source', v)} options={chipOptions(SCAN_SOURCES, t)} />
      </div>
      {order.source === 'lab_roll' ? (
        <div className="ps-mpro-group">
          <Field label={t('form.scan.ticket')} required>
            <input required placeholder={t('form.ph.scanTicket')} value={order.ticketRef} onChange={(e) => setOrderField('ticketRef', e.target.value)} />
          </Field>
        </div>
      ) : null}
      <p className="ps-msection-h" id="s-fmt">
        {t('form.scan.format')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips labelledBy="s-fmt" value={order.format} onChange={(v) => setOrderField('format', v)} options={chipOptions(SCAN_FORMATS, t)} />
      </div>
      {order.method === 'batch' ? (
        <>
          <p className="ps-msection-h" id="s-size">
            {t('form.scan.size')}
          </p>
          <div className="ps-mpro-group ps-mpro-group--pad">
            <PublicMobileChips labelledBy="s-size" value={order.scanSize} onChange={(v) => setOrderField('scanSize', v)} options={chipOptions(SCAN_SIZES, t)} />
          </div>
        </>
      ) : null}
      <p className="ps-msection-h" id="s-out">
        {t('form.scan.output')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips labelledBy="s-out" value={order.output} onChange={(v) => setOrderField('output', v)} options={chipOptions(SCAN_OUTPUTS, t)} />
      </div>
      <div className="ps-mpro-group">
        <div className="ps-mqty">
          <b>{t('form.scan.qty')}</b>
          <div className="ps-mqty-ctrl">
            <button type="button" aria-label={t('mpage.scanLess')} disabled={order.quantity <= 1} onClick={() => setOrderField('quantity', Math.max(1, order.quantity - 1))}>
              −
            </button>
            <output aria-live="polite">{order.quantity}</output>
            <button type="button" aria-label={t('mpage.scanAdd')} disabled={order.quantity >= 20} onClick={() => setOrderField('quantity', Math.min(20, order.quantity + 1))}>
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );

  if (compact) {
    const steps = ['mpage.scanStep', 'mpage.contactStep', 'mpage.scanReview'];
    return (
      <section className="ps-mform pm-film-form" id="mobile-scan-intake" aria-labelledby="mobile-scan-title">
        <h2 className="ps-msection-title" id="mobile-scan-title">
          {t('form.scan.h2')}
        </h2>
        {error ? (
          <p className="ps-mform-err" role="alert">
            {error}
          </p>
        ) : null}
        {done ? (
          <p ref={mobileStatus} tabIndex={-1} className="ps-mform-ok" role="status">
            {done}
          </p>
        ) : null}
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
            if (order.delivery === 'ship' && !String(order.address || '').trim()) {
              e.preventDefault();
              setError(t('mpage.need'));
              return;
            }
            handleSubmit(e);
          }}
        >
          <Honeypot />
          <input className="ps-hp" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <ol className="ps-mprogress" aria-label={t('form.scan.h2')}>
            {steps.map((key, index) => (
              <li key={key} className={step >= index + 1 ? 'is-on' : ''} aria-current={step === index + 1 ? 'step' : undefined}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                {t(key)}
              </li>
            ))}
          </ol>
          <h3 className="ps-mstep-title" key={step} ref={mobileStepTitle} tabIndex={-1}>
            {t(steps[step - 1])}
          </h3>
          {step === 1 ? jobFields : null}
          {step === 2 ? (
            <div className="ps-mpro-group">
              <Field label={t('form.last')} required>
                <input required placeholder={t('form.ph.last')} value={customer.firstName} onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })} autoComplete="family-name" />
              </Field>
              <Field label={t('form.first')} required>
                <input required placeholder={t('form.ph.first')} value={customer.lastName} onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })} autoComplete="given-name" />
              </Field>
              <Field label={t('form.email')} required>
                <input required type="email" placeholder="email@example.com" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} autoComplete="email" />
              </Field>
              <Field label={t('form.phone')} required>
                <input required type="tel" inputMode="tel" placeholder="0901234567" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} autoComplete="tel" />
              </Field>
            </div>
          ) : null}
          {step === 3 ? (
            <>
              <div className="pm-order-review">
                <div className="pm-order-review-title">
                  <b>
                    {order.quantity} × {methodLabel} · {t(`opt.scan.${order.format}`)} · {sizeLabel}
                  </b>
                  <button type="button" className="pm-icon-button" aria-label={t('mpage.editScan')} title={t('mpage.editScan')} onClick={() => setStep(1)} disabled={saving}>
                    <PublicMobileIcon name="edit" />
                  </button>
                </div>
                <p>
                  {t(`opt.scan.${order.source}`)} · {t(`opt.scan.${order.output}`)}
                </p>
                <div className="pm-order-customer">
                  <b>
                    {customer.firstName} {customer.lastName}
                  </b>
                  <span>{customer.email}</span>
                  <span>{customer.phone}</span>
                </div>
              </div>
              <p className="ps-msection-h" id="s-ret">
                {t('form.scan.handoff')}
              </p>
              <div className="ps-mpro-group ps-mpro-group--pad">
                <PublicMobileChips labelledBy="s-ret" value={order.delivery} onChange={(v) => setOrderField('delivery', v)} options={chipOptions(SCAN_DELIVERY, t)} />
              </div>
              {order.delivery === 'ship' ? (
                <div className="ps-mpro-group">
                  <Field label={t('form.address')} required>
                    <input required placeholder={t('form.ph.address')} value={order.address} onChange={(e) => setOrderField('address', e.target.value)} autoComplete="street-address" />
                  </Field>
                </div>
              ) : null}
              <div className="ps-mpro-group">
                <Field label={t('form.scan.note')}>
                  <textarea rows={3} placeholder={t('form.ph.scanNote')} value={order.note} onChange={(e) => setOrderField('note', e.target.value)} />
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
              <button key="next-scan" type="button" className="ps-mcta ps-mcta--fill" onClick={goNext}>
                {t('mpage.next')}
              </button>
            ) : (
              <button key="send-scan" type="submit" className="ps-mcta ps-mcta--fill" disabled={saving}>
                {saving ? t('form.sending') : t('form.scan.submit')}
              </button>
            )}
          </div>
        </form>
      </section>
    );
  }

  return (
    <section id="gui-don" className="ps-section">
      <h2>{t('form.scan.h2')}</h2>
      <p className="ps-form-lead">{t('form.scan.lead')}</p>
      {error ? <p className="ps-form-banner ps-form-banner--error">{error}</p> : null}
      {done ? <p className="ps-form-banner ps-form-banner--ok">{done}</p> : null}
      <form
        className="ps-form"
        onSubmit={(e) => {
          if (!jobValid() || (order.delivery === 'ship' && !String(order.address || '').trim())) {
            e.preventDefault();
            setError(t('mpage.need'));
            return;
          }
          handleSubmit(e);
        }}
      >
        <Honeypot />
        <input className="ps-hp" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <h3>{t('form.scan.method')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.scan.method')} required>
            <select value={order.method} onChange={(e) => setMethod(e.target.value)}>
              {SCAN_METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`opt.scan.${item.value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.scan.source')} required>
            <select value={order.source} onChange={(e) => setOrderField('source', e.target.value)}>
              {SCAN_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {t(`opt.scan.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.scan.format')} required>
            <select value={order.format} onChange={(e) => setOrderField('format', e.target.value)}>
              {SCAN_FORMATS.map((value) => (
                <option key={value} value={value}>
                  {t(`opt.scan.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          {order.method === 'batch' ? (
            <Field label={t('form.scan.size')} required>
              <select value={order.scanSize} onChange={(e) => setOrderField('scanSize', e.target.value)}>
                {SCAN_SIZES.map((value) => (
                  <option key={value} value={value}>
                    {t(`opt.scan.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label={t('form.scan.output')} required>
            <select value={order.output} onChange={(e) => setOrderField('output', e.target.value)}>
              {SCAN_OUTPUTS.map((value) => (
                <option key={value} value={value}>
                  {t(`opt.scan.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.scan.qty')} required>
            <input type="number" min={1} max={20} value={order.quantity} onChange={(e) => setOrderField('quantity', Math.min(20, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          {order.source === 'lab_roll' ? (
            <Field label={t('form.scan.ticket')} required>
              <input required placeholder={t('form.ph.scanTicket')} value={order.ticketRef} onChange={(e) => setOrderField('ticketRef', e.target.value)} />
            </Field>
          ) : null}
        </div>

        <h3>{t('form.customer')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.last')} required>
            <input required placeholder={t('form.ph.last')} value={customer.firstName} onChange={(e) => setCustomer({ ...customer, firstName: e.target.value })} autoComplete="family-name" />
          </Field>
          <Field label={t('form.first')} required>
            <input required placeholder={t('form.ph.first')} value={customer.lastName} onChange={(e) => setCustomer({ ...customer, lastName: e.target.value })} autoComplete="given-name" />
          </Field>
          <Field label={t('form.email')} required>
            <input required type="email" placeholder="email@example.com" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} autoComplete="email" />
          </Field>
          <Field label={t('form.phone')} required>
            <input required type="tel" inputMode="tel" placeholder="0901234567" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} autoComplete="tel" />
          </Field>
        </div>

        <h3>{t('form.scan.handoff')}</h3>
        <Field label={t('form.scan.handoff')}>
          <select value={order.delivery} onChange={(e) => setOrderField('delivery', e.target.value)}>
            {SCAN_DELIVERY.map((value) => (
              <option key={value} value={value}>
                {t(`opt.scan.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        {order.delivery === 'ship' ? (
          <Field label={t('form.address')} required>
            <input required placeholder={t('form.ph.address')} value={order.address} onChange={(e) => setOrderField('address', e.target.value)} autoComplete="street-address" />
          </Field>
        ) : null}
        <Field label={t('form.scan.note')}>
          <textarea rows={3} placeholder={t('form.ph.scanNote')} value={order.note} onChange={(e) => setOrderField('note', e.target.value)} />
        </Field>

        <PublicCaptcha ref={captchaRef} />
        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? t('form.sending') : t('form.scan.submit')}
        </button>
      </form>
    </section>
  );
}
