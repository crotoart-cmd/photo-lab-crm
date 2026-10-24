import { useEffect, useState } from 'react';
import { Download, ShieldCheck, ShieldPlus } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { apiErrorMessage } from '../../utils/apiError';
import TextField from '../TextField';
import FeedbackBanner from '../FeedbackBanner';
import MfaCodeField from './MfaCodeField';
import '../../styles/mfa.css';

export default function MfaSettings() {
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [action, setAction] = useState('');
  const [setup, setSetup] = useState(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/auth/mfa').then(({ data }) => { if (active) setStatus(data); })
      .catch((err) => { if (active) setError(apiErrorMessage(err, 'Không đọc được trạng thái 2FA.')); });
    return () => { active = false; };
  }, [user?.mfaEnabled]);

  useEffect(() => {
    if (!backupCodes.length) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [backupCodes]);

  const resetForm = () => {
    setAction(''); setSetup(null); setPassword(''); setCode(''); setRecovery(false); setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const { data: current } = await api.get('/auth/mfa');
      const operation = setup ? 'enable' : action;
      const { data } = await api.post(`/auth/mfa/${operation}`, {
        ...(password ? { currentPassword: password } : {}), ...(code ? { code: code.trim() } : {}),
      }, { headers: { 'X-MFA-CSRF': current.csrfToken } });
      setPassword(''); setCode('');
      if (operation === 'setup') {
        setSetup(data);
      } else {
        setSetup(null); setAction(''); setRecovery(false);
        if (data.recoveryCodes) { setBackupCodes(data.recoveryCodes); setSaved(false); }
        await refreshUser();
        const { data: next } = await api.get('/auth/mfa');
        setStatus(next);
        setNotice(operation === 'disable' ? 'Đã tắt xác thực hai bước.' : operation === 'enable' ? 'Đã bật Google Authenticator. Các phiên cũ đã được đăng xuất.' : 'Đã tạo bộ mã dự phòng mới. Bộ mã cũ không còn hiệu lực.');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Không cập nhật được Google Authenticator.'));
    } finally {
      setBusy(false);
    }
  };

  const downloadCodes = () => {
    const text = `HDTLabx - Recovery codes\n${user.email}\nEach code can be used once. Keep these private.\n\n${backupCodes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'hdtlabx-recovery-codes.txt'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="apple-card p-5 mb-6 mfa-settings" aria-labelledby="mfa-settings-title">
      <header className="mfa-settings-header">
        <ShieldCheck size={22} aria-hidden="true" />
        <h2 id="mfa-settings-title">Google Authenticator</h2>
        {status && <span className={`mfa-status ${status.enabled ? 'is-enabled' : ''}`}>{status.enabled ? 'Đang bật' : 'Chưa bật'}</span>}
      </header>
      {error && <FeedbackBanner variant="error" className="mt-3">{error}</FeedbackBanner>}
      {notice && <FeedbackBanner variant="success" className="mt-3">{notice}</FeedbackBanner>}
      {!status && !error && <p className="mfa-muted mt-3" role="status">Đang tải...</p>}
      {status && !status.available && <p className="mfa-muted mt-3">Máy chủ chưa cấu hình khóa mã hóa 2FA.</p>}

      {backupCodes.length > 0 ? (
        <div className="mfa-backup-panel">
          <h3>Mã dự phòng</h3>
          <p className="mfa-muted">Mỗi mã dùng một lần khi không có điện thoại. Bộ mã này chỉ hiển thị lần này; không chia sẻ cho người khác.</p>
          <ul className="mfa-backup-codes">{backupCodes.map((backup) => <li key={backup}><code>{backup}</code></li>)}</ul>
          <button type="button" className="apple-btn-secondary mfa-command" onClick={downloadCodes}><Download size={18} aria-hidden="true" />Tải mã dự phòng</button>
          <label className="mfa-saved"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />Tôi đã lưu mã dự phòng ở nơi an toàn</label>
          <button type="button" className="apple-btn-primary w-full" disabled={!saved} onClick={() => { setBackupCodes([]); setSaved(false); }}>Hoàn tất</button>
        </div>
      ) : action ? (
        <form onSubmit={submit} className="mfa-form" aria-busy={busy}>
          {setup ? (
            <>
              <p className="mfa-muted">Quét QR bằng Google Authenticator, rồi nhập mã 6 số để bật 2FA.</p>
              <img className="mfa-qr" src={setup.qrCode} alt="QR liên kết Google Authenticator cho HDTLabx" width="240" height="240" />
              <details className="mfa-manual"><summary>Khóa nhập tay</summary><code>{setup.secret}</code></details>
              <TextField label="Mã 6 số" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus disabled={busy} />
            </>
          ) : (
            <>
              <h3>{action === 'setup' ? 'Liên kết điện thoại' : action === 'disable' ? 'Tắt xác thực hai bước' : 'Tạo mã dự phòng mới'}</h3>
              {action === 'disable' && <p className="mfa-muted">Sau khi tắt, tài khoản chỉ còn được bảo vệ bằng mật khẩu.</p>}
              <TextField label="Mật khẩu hiện tại" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={busy} />
              {action !== 'setup' && <MfaCodeField value={code} onChange={setCode} recovery={recovery} onRecoveryChange={setRecovery} disabled={busy} />}
            </>
          )}
          <div className="mfa-form-actions">
            <button type="button" className="apple-btn-secondary" disabled={busy} onClick={resetForm}>Hủy</button>
            <button type="submit" className="apple-btn-primary" disabled={busy}>{busy ? 'Đang xác thực...' : setup ? 'Xác nhận và bật 2FA' : action === 'setup' ? 'Tạo QR' : action === 'disable' ? 'Xác nhận tắt' : 'Tạo mã mới'}</button>
          </div>
        </form>
      ) : status?.available && (
        <div className="mfa-settings-actions">
          {status.enabled ? (
            <>
              <p className="mfa-muted">Còn {status.recoveryCodesRemaining} mã dự phòng.</p>
              <button type="button" className="apple-btn-secondary" onClick={() => { resetForm(); setAction('recovery-codes'); }}>Tạo mã dự phòng mới</button>
              <button type="button" className="mfa-disable" onClick={() => { resetForm(); setAction('disable'); }}>Tắt 2FA</button>
            </>
          ) : <button type="button" className="apple-btn-primary mfa-command w-full" onClick={() => { resetForm(); setAction('setup'); }}><ShieldPlus size={18} aria-hidden="true" />Bật Google Authenticator</button>}
        </div>
      )}
    </section>
  );
}
