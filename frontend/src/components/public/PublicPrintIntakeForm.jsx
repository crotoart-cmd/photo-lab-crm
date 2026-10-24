import { useEffect, useRef, useState } from 'react';
import publicApi from '../../api/publicClient';
import {
  PRINT_DELIVERY,
  PRINT_FILE_HANDOFF,
  PRINT_METHODS,
  PRINT_PAPERS,
  PRINT_SIZES,
  PRINT_SOURCES,
  applyPrintMethod,
  emptyPrintOrder,
} from '../../data/printOrderOptions';
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

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function chipOptions(values, t) {
  return values.map((value) => ({ value, label: t(`opt.print.${value}`) }));
}

export default function PublicPrintIntakeForm({ compact = false }) {
  const { t } = usePublicLocale();
  const [customer, setCustomer] = useState(emptyCustomer);
  const [order, setOrder] = useState(emptyPrintOrder);
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
  const setMethod = (method) => setOrder((prev) => applyPrintMethod(prev, method));

  const jobValid = () => {
    if (order.size === 'custom' && !String(order.customSize || '').trim()) return false;
    if (order.source === 'files' && order.fileHandoff === 'link' && !isHttpUrl(order.fileLink)) return false;
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDone('');
    setSaving(true);
    try {
      const { data } = await publicApi.post('/public/print', {
        ...customer,
        website,
        ...order,
        ...captchaFields(captchaRef),
      });
      pingWebInbox();
      setDone(data.message || `${t('form.ok.print')} ${data.code || ''}`.trim());
      setCustomer(emptyCustomer);
      setOrder(emptyPrintOrder);
      setStep(1);
    } catch (err) {
      captchaRef.current?.reload();
      setError(err.response?.data?.message || t('form.err.print'));
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

  const sources = PRINT_SOURCES[order.method];
  const papers = PRINT_PAPERS[order.method];
  const methodLabel = t(`opt.print.${order.method}`);
  const sizeLabel = order.size === 'custom' ? order.customSize : t(`opt.print.${order.size}`);

  const jobFields = (
    <>
      <p className="ps-msection-h" id="p-method">
        {t('form.print.method')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips
          labelledBy="p-method"
          value={order.method}
          onChange={setMethod}
          options={PRINT_METHODS.map((item) => ({
            value: item.value,
            label: t(`opt.print.${item.value}`),
            hint: t(item.hintKey),
          }))}
        />
      </div>
      <p className="ps-msection-h" id="p-source">
        {t('form.print.source')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips labelledBy="p-source" value={order.source} onChange={(v) => setOrderField('source', v)} options={chipOptions(sources, t)} />
      </div>
      {order.source === 'files' ? (
        <>
          <p className="ps-msection-h" id="p-files">
            {t('form.print.files')}
          </p>
          <div className="ps-mpro-group ps-mpro-group--pad">
            <PublicMobileChips
              labelledBy="p-files"
              value={order.fileHandoff}
              onChange={(v) => setOrderField('fileHandoff', v)}
              options={chipOptions(PRINT_FILE_HANDOFF, t)}
            />
          </div>
          {order.fileHandoff === 'link' ? (
            <div className="ps-mpro-group">
              <Field label={t('form.print.link')} required>
                <input
                  required
                  type="url"
                  inputMode="url"
                  placeholder={t('form.ph.printLink')}
                  value={order.fileLink}
                  onChange={(e) => setOrderField('fileLink', e.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </>
      ) : null}
      <p className="ps-msection-h" id="p-size">
        {t('form.print.size')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips labelledBy="p-size" value={order.size} onChange={(v) => setOrderField('size', v)} options={chipOptions(PRINT_SIZES, t)} />
      </div>
      {order.size === 'custom' ? (
        <div className="ps-mpro-group">
          <Field label={t('form.print.custom')} required>
            <input required placeholder={t('form.ph.printCustom')} value={order.customSize} onChange={(e) => setOrderField('customSize', e.target.value)} />
          </Field>
        </div>
      ) : null}
      <p className="ps-msection-h" id="p-paper">
        {t('form.print.paper')}
      </p>
      <div className="ps-mpro-group ps-mpro-group--pad">
        <PublicMobileChips labelledBy="p-paper" value={order.paper} onChange={(v) => setOrderField('paper', v)} options={chipOptions(papers, t)} />
      </div>
      <div className="ps-mpro-group">
        <div className="ps-mqty">
          <b>{t('form.print.qty')}</b>
          <div className="ps-mqty-ctrl">
            <button type="button" aria-label={t('mpage.printLess')} disabled={order.quantity <= 1} onClick={() => setOrderField('quantity', Math.max(1, order.quantity - 1))}>
              −
            </button>
            <output aria-live="polite">{order.quantity}</output>
            <button type="button" aria-label={t('mpage.printAdd')} disabled={order.quantity >= 40} onClick={() => setOrderField('quantity', Math.min(40, order.quantity + 1))}>
              +
            </button>
          </div>
        </div>
      </div>
    </>
  );

  if (compact) {
    const steps = ['mpage.printStep', 'mpage.contactStep', 'mpage.printReview'];
    return (
      <section className="ps-mform pm-film-form" id="mobile-print-intake" aria-labelledby="mobile-print-title">
        <h2 className="ps-msection-title" id="mobile-print-title">
          {t('form.print.h2')}
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
          <ol className="ps-mprogress" aria-label={t('form.print.h2')}>
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
                    {order.quantity} × {methodLabel} · {sizeLabel}
                  </b>
                  <button type="button" className="pm-icon-button" aria-label={t('mpage.editPrint')} title={t('mpage.editPrint')} onClick={() => setStep(1)} disabled={saving}>
                    <PublicMobileIcon name="edit" />
                  </button>
                </div>
                <p>
                  {t(`opt.print.${order.source}`)} · {t(`opt.print.${order.paper}`)}
                </p>
                <div className="pm-order-customer">
                  <b>
                    {customer.firstName} {customer.lastName}
                  </b>
                  <span>{customer.email}</span>
                  <span>{customer.phone}</span>
                </div>
              </div>
              <p className="ps-msection-h" id="p-ret">
                {t('form.print.handoff')}
              </p>
              <div className="ps-mpro-group ps-mpro-group--pad">
                <PublicMobileChips labelledBy="p-ret" value={order.delivery} onChange={(v) => setOrderField('delivery', v)} options={chipOptions(PRINT_DELIVERY, t)} />
              </div>
              {order.delivery === 'ship' ? (
                <div className="ps-mpro-group">
                  <Field label={t('form.address')} required>
                    <input required placeholder={t('form.ph.address')} value={order.address} onChange={(e) => setOrderField('address', e.target.value)} autoComplete="street-address" />
                  </Field>
                </div>
              ) : null}
              <div className="ps-mpro-group">
                <Field label={t('form.print.note')}>
                  <textarea rows={3} placeholder={t('form.ph.printNote')} value={order.note} onChange={(e) => setOrderField('note', e.target.value)} />
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
              <button key="next-print" type="button" className="ps-mcta ps-mcta--fill" onClick={goNext}>
                {t('mpage.next')}
              </button>
            ) : (
              <button key="send-print" type="submit" className="ps-mcta ps-mcta--fill" disabled={saving}>
                {saving ? t('form.sending') : t('form.print.submit')}
              </button>
            )}
          </div>
        </form>
      </section>
    );
  }

  return (
    <section id="gui-don" className="ps-section">
      <h2>{t('form.print.h2')}</h2>
      <p className="ps-form-lead">{t('form.print.lead')}</p>
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

        <h3>{t('form.print.method')}</h3>
        <div className="ps-form-grid">
          <Field label={t('form.print.method')} required>
            <select value={order.method} onChange={(e) => setMethod(e.target.value)}>
              {PRINT_METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(`opt.print.${item.value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.print.source')} required>
            <select value={order.source} onChange={(e) => setOrderField('source', e.target.value)}>
              {sources.map((value) => (
                <option key={value} value={value}>
                  {t(`opt.print.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.print.size')} required>
            <select value={order.size} onChange={(e) => setOrderField('size', e.target.value)}>
              {PRINT_SIZES.map((value) => (
                <option key={value} value={value}>
                  {t(`opt.print.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.print.paper')} required>
            <select value={order.paper} onChange={(e) => setOrderField('paper', e.target.value)}>
              {papers.map((value) => (
                <option key={value} value={value}>
                  {t(`opt.print.${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.print.qty')} required>
            <input type="number" min={1} max={40} value={order.quantity} onChange={(e) => setOrderField('quantity', Math.min(40, Math.max(1, Number(e.target.value) || 1)))} />
          </Field>
          {order.size === 'custom' ? (
            <Field label={t('form.print.custom')} required>
              <input required placeholder={t('form.ph.printCustom')} value={order.customSize} onChange={(e) => setOrderField('customSize', e.target.value)} />
            </Field>
          ) : null}
        </div>
        {order.source === 'files' ? (
          <div className="ps-form-grid">
            <Field label={t('form.print.files')}>
              <select value={order.fileHandoff} onChange={(e) => setOrderField('fileHandoff', e.target.value)}>
                {PRINT_FILE_HANDOFF.map((value) => (
                  <option key={value} value={value}>
                    {t(`opt.print.${value}`)}
                  </option>
                ))}
              </select>
            </Field>
            {order.fileHandoff === 'link' ? (
              <Field label={t('form.print.link')} required>
                <input required type="url" placeholder={t('form.ph.printLink')} value={order.fileLink} onChange={(e) => setOrderField('fileLink', e.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}

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

        <h3>{t('form.print.handoff')}</h3>
        <Field label={t('form.print.handoff')}>
          <select value={order.delivery} onChange={(e) => setOrderField('delivery', e.target.value)}>
            {PRINT_DELIVERY.map((value) => (
              <option key={value} value={value}>
                {t(`opt.print.${value}`)}
              </option>
            ))}
          </select>
        </Field>
        {order.delivery === 'ship' ? (
          <Field label={t('form.address')} required>
            <input required placeholder={t('form.ph.address')} value={order.address} onChange={(e) => setOrderField('address', e.target.value)} autoComplete="street-address" />
          </Field>
        ) : null}
        <Field label={t('form.print.note')}>
          <textarea rows={3} placeholder={t('form.ph.printNote')} value={order.note} onChange={(e) => setOrderField('note', e.target.value)} />
        </Field>

        <PublicCaptcha ref={captchaRef} />
        <button type="submit" className="ps-cta ps-cta--on-dark" disabled={saving}>
          {saving ? t('form.sending') : t('form.print.submit')}
        </button>
      </form>
    </section>
  );
}
