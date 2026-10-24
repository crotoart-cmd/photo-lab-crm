import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import publicApi from '../../api/publicClient';
import { usePublicLocale } from './PublicLocale';

const PublicCaptcha = forwardRef(function PublicCaptcha(_props, ref) {
  const { lang } = usePublicLocale();
  const [token, setToken] = useState('');
  const [image, setImage] = useState('');
  const [answer, setAnswer] = useState('');
  const label = lang === 'vi' ? 'Mã xác nhận' : 'Check code';

  const load = async () => {
    const { data } = await publicApi.get('/public/captcha');
    setToken(data.token || '');
    setImage(data.image || '');
    setAnswer('');
  };

  useEffect(() => {
    load().catch(() => setImage(''));
  }, []);

  useImperativeHandle(ref, () => ({
    payload: () => ({ captchaToken: token, captchaAnswer: answer }),
    reload: () => load().catch(() => setImage('')),
  }));

  return (
    <label className="ps-field ps-captcha">
      <span>{label} *</span>
      {image ? <img src={image} alt="" width="164" height="52" /> : <span className="ps-captcha-wait">{lang === 'vi' ? 'Đang tải mã' : 'Loading'}</span>}
      <input
        required
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={8}
        inputMode="text"
        aria-label={label}
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
    </label>
  );
});

export function captchaFields(ref) {
  return ref.current?.payload() || { captchaToken: '', captchaAnswer: '' };
}

export default PublicCaptcha;
