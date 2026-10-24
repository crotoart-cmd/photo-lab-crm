import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import publicApi from '../../api/publicClient';
import { usePublicLocale } from './PublicLocale';
import { Field } from './PublicIntakeFields';
import PublicCaptcha, { captchaFields } from './PublicCaptcha';
import { pingWebInbox } from '../../lib/webInboxPing';
import PublicMobileIcon from './PublicMobileIcon';

const empty = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  quantity: 1,
  delivery: 'pickup',
  address: '',
  note: '',
};

function galleryOf(item) {
  const list = [];
  for (const src of [item.image, ...(item.images || [])]) {
    if (src && !list.includes(src)) list.push(src);
  }
  return list;
}

export default function PublicShopOrderSheet({ item, priceLabel, onClose, onOrdered }) {
  const { t } = usePublicLocale();
  const [form, setForm] = useState({ ...empty, quantity: 1 });
  const [website, setWebsite] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState(0);
  const captchaRef = useRef(null);
  const gallery = galleryOf(item);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setPhoto((i) => Math.min(gallery.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setPhoto((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, gallery.length]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const maxQty = item.source === 'camera' ? 1 : Math.max(1, Math.min(20, Number(item.free ?? item.quantity) || 1));
  const qty = Math.min(maxQty, Math.max(1, Number(form.quantity) || 1));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await publicApi.post('/public/shop/orders', {
        ...form,
        quantity: qty,
        website,
        items: [{ source: item.source, id: item.id, quantity: qty }],
        ...captchaFields(captchaRef),
      });
      pingWebInbox();
      setCode(data.code || '');
      onOrdered?.();
    } catch (err) {
      captchaRef.current?.reload();
      setError(err.response?.data?.message || t('acc.err'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="ps-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ps-sheet ps-sheet--product"
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="ps-sheet-close" aria-label={t('acc.close')} onClick={onClose}>
          <span className="pm-sheet-close-legacy" aria-hidden="true">×</span>
          <span className="pm-sheet-close-vector" hidden><PublicMobileIcon name="close" /></span>
        </button>

        <div className="ps-sheet-product">
          <div>
            <div className="ps-sheet-gallery">
              {gallery[photo] ? (
                <img src={gallery[photo]} alt="" />
              ) : (
                <div className="ps-sheet-gallery-empty" />
              )}
            </div>
            {gallery.length > 1 ? (
              <div className="ps-sheet-dots">
                {gallery.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    className={i === photo ? 'is-on' : undefined}
                    aria-label={`${i + 1}`}
                    onClick={() => setPhoto(i)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="ps-sheet-copy">
            {item.brand ? <p className="ps-shop-brand">{item.brand}</p> : null}
            <h2>{item.title}</h2>
            <p className="ps-sheet-price">{item.available ? priceLabel : t('acc.sold')}</p>
            {item.description ? <p className="ps-sheet-desc">{item.description}</p> : null}

            {code ? (
              <div className="ps-sheet-done">
                <h3>{t('acc.okH')}</h3>
                <p>
                  {t('acc.ok')} <strong>{code}</strong>
                </p>
                <button type="button" className="ps-cta ps-cta--fill" onClick={onClose}>
                  {t('acc.close')}
                </button>
              </div>
            ) : !item.available || !item.orderable ? (
              <p className="ps-form-banner">{t('acc.sold')}</p>
            ) : (
              <form className="ps-form" onSubmit={handleSubmit}>
                {error ? <p className="ps-form-banner ps-form-banner--error">{error}</p> : null}
                <input
                  className="ps-hp"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {maxQty > 1 ? (
                  <div className="ps-sheet-qty">
                    <span>{t('acc.qty')}</span>
                    <div className="ps-sheet-stepper">
                      <button
                        type="button"
                        disabled={qty <= 1}
                        onClick={() => setForm((f) => ({ ...f, quantity: qty - 1 }))}
                      >
                        −
                      </button>
                      <input
                        inputMode="numeric"
                        aria-label={t('acc.qty')}
                        value={qty}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            quantity: Math.min(maxQty, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)),
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={qty >= maxQty}
                        onClick={() => setForm((f) => ({ ...f, quantity: qty + 1 }))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="ps-form-grid">
                  <Field label={t('form.last')} required>
                    <input required placeholder={t('form.ph.last')} value={form.firstName} onChange={set('firstName')} />
                  </Field>
                  <Field label={t('form.first')} required>
                    <input required placeholder={t('form.ph.first')} value={form.lastName} onChange={set('lastName')} />
                  </Field>
                  <Field label={t('form.email')} required>
                    <input required type="email" placeholder="email@example.com" value={form.email} onChange={set('email')} />
                  </Field>
                  <Field label={t('form.phone')} required>
                    <input required inputMode="tel" placeholder="0901234567" value={form.phone} onChange={set('phone')} />
                  </Field>
                </div>

                <fieldset className="ps-sheet-choice">
                  <legend>{t('acc.delivery')}</legend>
                  {['pickup', 'ship'].map((value) => (
                    <label key={value} className={form.delivery === value ? 'is-on' : undefined}>
                      <input
                        type="radio"
                        name="delivery"
                        value={value}
                        checked={form.delivery === value}
                        onChange={set('delivery')}
                      />
                      {t(`acc.${value}`)}
                    </label>
                  ))}
                </fieldset>

                {form.delivery === 'ship' ? (
                  <Field label={t('acc.address')} required>
                    <textarea required rows={2} value={form.address} onChange={set('address')} />
                  </Field>
                ) : null}

                <Field label={t('acc.note')}>
                  <textarea rows={2} value={form.note} onChange={set('note')} />
                </Field>
                <PublicCaptcha ref={captchaRef} />

                <button type="submit" className="ps-cta ps-cta--fill" disabled={saving}>
                  {saving ? t('form.sending') : t('acc.submit')}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
