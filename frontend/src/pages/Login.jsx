import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiErrorMessage } from '../utils/apiError';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { readOfflineCredentials } from '../lib/mobileOfflineAuth';
import TextField from '../components/TextField';
import BrandLogo from '../components/BrandLogo';
import LoadingIndicator from '../components/LoadingIndicator';
import IconMail from '../components/icons/IconMail';
import IconLock from '../components/icons/IconLock';
import { needsServerUrlSetup } from '../config/apiBase';
import ServerUrlField from '../components/ServerUrlField';
import MfaCodeField from '../components/security/MfaCodeField';

export default function Login() {
  const { login, completeMfaLogin, loginOfflineOnly, isAuthenticated, continueOffline } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [info, setInfo] = useState(() => {
    const notice = sessionStorage.getItem('hdtlabx_login_notice');
    if (notice) {
      sessionStorage.removeItem('hdtlabx_login_notice');
      return notice;
    }
    return new URLSearchParams(window.location.search).get('reason') === 'expired' ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : '';
  });
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const canOffline =
    isMobileDataEnabled() &&
    Boolean(localStorage.getItem('token')) &&
    Boolean(localStorage.getItem('user'));
  const hasOfflineCreds = Boolean(readOfflineCredentials());
  const [form, setForm] = useState({
    email: 'crotoart@gmail.com',
    password: '',
  });

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const result = challenge
        ? await completeMfaLogin(challenge, code.trim())
        : await login(form.email, form.password);
      if (result?.requiresMfa) {
        setChallenge(result.challengeToken);
        setForm((previous) => ({ ...previous, password: '' }));
        setCode('');
        return;
      }
      if (result?.offlineBootstrap) {
        setInfo('Đã lưu trên máy — dùng độc lập. Đồng bộ Mac khi bạn muốn (tuỳ chọn).');
      }
      navigate('/');
    } catch (err) {
      if (err.code === 'OFFLINE_WRONG_PASSWORD') {
        setError('Mật khẩu không đúng (offline trên máy này)');
      } else if (err.code === 'OFFLINE_MFA_REQUIRED') {
        setError('Tài khoản bật 2FA. Cần mạng để xác thực.');
      } else if (
        isMobileDataEnabled() &&
        canOffline &&
        (!err.response || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED')
      ) {
        if (continueOffline()) {
          navigate('/');
          return;
        }
      }
      setError(apiErrorMessage(err, 'Đăng nhập thất bại'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ios-login-screen md:min-h-screen md:flex md:items-center md:justify-center md:p-6" style={{ background: 'var(--color-bg)' }}>
      <div className="ios-login-card md:apple-card md:max-w-[420px] md:p-8">
        <div className="text-center mb-8 flex flex-col items-center">
          <BrandLogo size="sm" className="items-center" />
        </div>

        {isMobileDataEnabled() && !hasOfflineCreds && (
          <p className="text-[11px] text-[var(--color-label-secondary)] mb-3 px-1">
            Máy tính bảng / iPhone chạy độc lập: nhập email + mật khẩu (≥6 ký tự) rồi Đăng nhập —
            lưu trên máy, không cần Mac. Đồng bộ Mac chỉ khi bạn mở mục tuỳ chọn bên dưới.
          </p>
        )}

        {needsServerUrlSetup() && <ServerUrlField defaultOpen={false} />}

        {loading ? (
          <LoadingIndicator label="Đang đăng nhập..." />
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {challenge ? (
            <>
              <h1 className="text-lg font-semibold">Xác thực hai bước</h1>
              <MfaCodeField value={code} onChange={setCode} recovery={recovery} onRecoveryChange={setRecovery} autoFocus />
            </>
          ) : (
          <>
          <TextField
            label="Email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="crotoart@gmail.com"
            leadingIconComponent={<IconMail />}
            autoComplete="email"
          />
          <TextField
            label="Mật khẩu"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
            placeholder="Mật khẩu"
            leadingIconComponent={<IconLock />}
            autoComplete="current-password"
          />
          </>
          )}
          {error && <div className="apple-alert-error">{error}</div>}
          {info && <div className="text-[13px] text-[var(--color-green)]">{info}</div>}
          <button type="submit" className="btn-pill btn-pill--lv1 btn-pill--48 btn-pill--block mt-2">
            {challenge ? 'Xác nhận' : 'Đăng nhập'}
          </button>
          {challenge && (
            <button type="button" className="action-btn action-btn--block" onClick={() => { setChallenge(null); setCode(''); setError(''); setRecovery(false); }}>
              Quay lại đăng nhập
            </button>
          )}
          {!challenge && isMobileDataEnabled() && (
            <button
              type="button"
              className="action-btn action-btn--block mt-2"
              disabled={!form.password || form.password.length < 6}
              onClick={async () => {
                setError('');
                setInfo('');
                setLoading(true);
                try {
                  const result = await loginOfflineOnly(form.email, form.password);
                  if (result?.offlineBootstrap) {
                    setInfo('Đã lưu trên máy — dùng độc lập.');
                  }
                  navigate('/');
                } catch (err) {
                  if (err.code === 'OFFLINE_WRONG_PASSWORD') {
                    setError('Mật khẩu không đúng (offline trên máy này)');
                  } else {
                    setError(apiErrorMessage(err, 'Không thiết lập được offline'));
                  }
                } finally {
                  setLoading(false);
                }
              }}
            >
              {hasOfflineCreds ? 'Vào app offline' : 'Thiết lập offline (không cần Mac)'}
            </button>
          )}
          {!challenge && canOffline && (
            <button
              type="button"
              className="action-btn action-btn--block mt-2"
              onClick={() => {
                if (continueOffline()) navigate('/');
              }}
            >
              Vào app offline (đã đăng nhập trước đó)
            </button>
          )}
        </form>
        )}
      </div>
    </div>
  );
}
