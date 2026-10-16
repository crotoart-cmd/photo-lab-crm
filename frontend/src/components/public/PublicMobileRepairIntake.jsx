import { useEffect, useRef, useState } from 'react';
import masterCameraCatalog from '../../data/masterCameraCatalog.json';
import { composeRepairSymptom, REPAIR_SYMPTOMS, repairStepIssue, toggleRepairSymptom, updateRepairModel } from '../../lib/publicRepairIntake';
import { Field, Honeypot } from './PublicIntakeFields';
import { usePublicLocale } from './PublicLocale';
import PublicMobileIcon from './PublicMobileIcon';

export default function PublicMobileRepairIntake({ form, setForm, website, setWebsite, saving, error, done, onSubmit, onReset, clearError }) {
  const { t } = usePublicLocale();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState([]);
  const [validation, setValidation] = useState('');
  const formRef = useRef(null);
  const titleRef = useRef(null);
  const successRef = useRef(null);
  const errorRef = useRef(null);
  const previousStep = useRef(step);
  const symptom = composeRepairSymptom(selected, form.symptom, (id) => t(`rp.symptom.${id}`));
  const steps = ['rp.cameraStep', 'mpage.contactStep', 'exp.reviewStep'];
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (previousStep.current !== step) titleRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  useEffect(() => { if (done) successRef.current?.focus(); }, [done]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const goTo = (next) => {
    setValidation('');
    clearError();
    setStep(next);
  };

  const goNext = () => {
    if (!formRef.current.reportValidity()) return;
    const issue = repairStepIssue(form, symptom, step);
    if (issue) {
      setValidation(t('mpage.need'));
      formRef.current.elements.namedItem(issue)?.focus();
      return;
    }
    goTo(Math.min(3, step + 1));
  };

  return <section className="ps-mform pm-film-form pm-repair-form" id="mobile-repair-intake" aria-labelledby="mobile-repair-title">
    <h2 className="ps-msection-title" id="mobile-repair-title">{t('form.repair.h2')}</h2>
    {done ? <div className="pm-repair-success" ref={successRef} tabIndex={-1}>
      <PublicMobileIcon name="check_circle" />
      <p role="status" className="ps-mform-ok">{done}</p>
      <h3>{t('rp.nextTitle')}</h3><p>{t('rp.successBody')}</p>
      <button type="button" className="pm-secondary" onClick={() => { setSelected([]); goTo(1); onReset(); }}>{t('rp.another')}<PublicMobileIcon name="add" /></button>
    </div> : <>
      {validation || error ? <p className="ps-mform-err" role="alert" ref={errorRef} tabIndex={-1}>{validation || error}</p> : null}
      <form ref={formRef} aria-busy={saving} onSubmit={(event) => {
        event.preventDefault();
        if (saving) return;
        if (step < 3) { goNext(); return; }
        for (const check of [1, 2]) {
          if (repairStepIssue(form, symptom, check)) { goTo(check); setValidation(t('mpage.need')); return; }
        }
        onSubmit(event, { ...form, symptom });
      }}>
        <Honeypot />
        <input className="ps-hp" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <ol className="ps-mprogress" aria-label={t('form.repair.h2')}>
          {steps.map((key, index) => <li key={key} className={step >= index + 1 ? 'is-on' : ''} aria-current={step === index + 1 ? 'step' : undefined}><span>{String(index + 1).padStart(2, '0')}</span>{t(key)}</li>)}
        </ol>
        <h3 className="ps-mstep-title" ref={titleRef} tabIndex={-1}>{t(steps[step - 1])}</h3>
        <fieldset className="pm-repair-fields" disabled={saving}>
          {step === 1 ? <>
            <div className="ps-mpro-group">
              <Field label={t('form.repair.model')} required><input name="model_name" required maxLength={120} list="mobile-repair-models" autoComplete="off" placeholder={t('form.ph.model')} value={form.model_name} onChange={(event) => setForm((current) => updateRepairModel(current, event.target.value, masterCameraCatalog))} /></Field>
              <datalist id="mobile-repair-models">{masterCameraCatalog.map((item) => <option key={item.catalogKey} value={item.model} />)}</datalist>
              <Field label={t('form.repair.brand')}><input name="brand" maxLength={80} placeholder="Canon, Nikon, Olympus…" value={form.brand} onChange={set('brand')} /></Field>
            </div>
            <p className="pm-repair-caption">{t('rp.modelHint')}</p>
            <div className="pm-section-heading pm-repair-symptom-heading"><h4 id="repair-symptoms">{t('rp.symptoms')}</h4><PublicMobileIcon name="build" /></div>
            <div className="pm-repair-symptoms" role="group" aria-labelledby="repair-symptoms">
              {REPAIR_SYMPTOMS.map((item) => <label key={item.id} className={selected.includes(item.id) ? 'is-on' : ''}>
                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected((current) => toggleRepairSymptom(current, item.id))} />
                <PublicMobileIcon name={item.icon} /><span>{t(`rp.symptom.${item.id}`)}</span><PublicMobileIcon name={selected.includes(item.id) ? 'check_circle' : 'add_circle_outline'} />
              </label>)}
            </div>
            <Field label={t('rp.describe')} required={!selected.length}><textarea name="symptom" required={!selected.length} maxLength={600} rows={3} placeholder={t('rp.describePlaceholder')} value={form.symptom} onChange={set('symptom')} /></Field>
            <p className="pm-repair-caption">{t('rp.checkFirst')}</p>
            <details className="pm-repair-extra"><summary>{t('rp.extra')}<PublicMobileIcon name="expand_more" /></summary><div>
              <Field label={t('form.repair.serial')}><input name="serial_number" maxLength={80} value={form.serial_number} onChange={set('serial_number')} /></Field>
              <Field label={t('form.repair.condition')}><textarea name="condition_at_intake" maxLength={800} rows={3} placeholder={t('form.ph.condition')} value={form.condition_at_intake} onChange={set('condition_at_intake')} /></Field>
            </div></details>
          </> : step === 2 ? <div className="ps-mpro-group">
            <Field label={t('form.last')} required><input name="firstName" required maxLength={100} autoComplete="family-name" placeholder={t('form.ph.last')} value={form.firstName} onChange={set('firstName')} /></Field>
            <Field label={t('form.first')} required><input name="lastName" required maxLength={100} autoComplete="given-name" placeholder={t('form.ph.first')} value={form.lastName} onChange={set('lastName')} /></Field>
            <Field label={t('form.email')} required><input name="email" required type="email" maxLength={254} autoComplete="email" placeholder="email@example.com" value={form.email} onChange={set('email')} /></Field>
            <Field label={t('form.phone')} required><input name="phone" required type="tel" maxLength={40} autoComplete="tel" placeholder="0901234567" value={form.phone} onChange={set('phone')} /></Field>
          </div> : <>
            <div className="pm-repair-review">
              <div className="pm-order-review-title"><span><small>{t('form.repair.cam')}</small><b>{form.model_name}</b></span><button type="button" className="pm-icon-button" aria-label={t('rp.editCamera')} title={t('rp.editCamera')} onClick={() => goTo(1)}><PublicMobileIcon name="edit" /></button></div>
              {form.brand || form.serial_number ? <p className="pm-repair-caption">{[form.brand, form.serial_number].filter(Boolean).join(' / ')}</p> : null}
              <p className="pm-repair-description">{symptom}</p>
              {form.condition_at_intake ? <p className="pm-repair-description"><b>{t('form.repair.condition')}</b>{form.condition_at_intake}</p> : null}
              <div className="pm-order-review-title pm-repair-contact-review"><span><small>{t('form.customer')}</small><b>{form.firstName} {form.lastName}</b></span><button type="button" className="pm-icon-button" aria-label={t('rp.editContact')} title={t('rp.editContact')} onClick={() => goTo(2)}><PublicMobileIcon name="edit" /></button></div>
              <div className="pm-order-customer"><span>{form.email}</span><span>{form.phone}</span></div>
            </div>
            <Field label={t('form.repair.note')}><textarea name="intake_note" maxLength={800} rows={3} value={form.intake_note} onChange={set('intake_note')} /></Field>
            <div className="pm-repair-consent"><PublicMobileIcon name="mark_email_read" /><p>{t('rp.beforeSend')}</p></div>
          </>}
        </fieldset>
        <div className="ps-mform-nav">
          {step > 1 ? <button type="button" disabled={saving} className="ps-mcta ps-mcta--ghost" onClick={() => goTo(step - 1)}>{t('mpage.prev')}</button> : null}
          {step < 3 ? <button key="next-repair-step" type="button" className="ps-mcta ps-mcta--fill" onClick={goNext}>{t('mpage.next')}<PublicMobileIcon name="arrow_forward" /></button> : <button key="submit-repair" type="submit" className="ps-mcta ps-mcta--fill" disabled={saving}>{saving ? t('form.sending') : t('rp.request')}<PublicMobileIcon name={saving ? 'hourglass_top' : 'arrow_forward'} /></button>}
        </div>
      </form>
    </>}
  </section>;
}
