import { useEffect, useState } from 'react';
import { LogOut, Monitor, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import FeedbackBanner from '../FeedbackBanner';
import { apiErrorMessage } from '../../utils/apiError';
import '../../styles/mfa.css';

const eventNames = { login: 'Đăng nhập', mfa_login: 'Xác thực 2FA', mfa_setup: 'Tạo QR 2FA', mfa_enable: 'Bật 2FA',
  mfa_disable: 'Tắt 2FA', mfa_recovery: 'Tạo mã dự phòng', profile: 'Cập nhật hồ sơ', logout: 'Đăng xuất', session_revoke: 'Thu hồi phiên' };
const outcomes = { success: 'Thành công', failure: 'Không thành công', challenge: 'Chờ mã 2FA' };
const time = (value) => new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

export default function SessionSettings() {
  const { setUser } = useAuth();
  const [tab, setTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setBusy(true); setError('');
    try {
      const [active, history] = await Promise.all([api.get('/auth/sessions'), api.get('/auth/security-events')]);
      setSessions(active.data.sessions); setEvents(history.data.events);
    } catch (err) { setError(apiErrorMessage(err, 'Không tải được thông tin phiên.')); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  const revoke = async (id) => {
    setBusy(true); setError('');
    try {
      const { data } = await api.delete(`/auth/sessions/${id}`);
      if (data.current) {
        localStorage.removeItem('user'); localStorage.removeItem('token'); setUser(null);
      } else await load();
    } catch (err) { setError(apiErrorMessage(err, 'Không thu hồi được phiên.')); }
    finally { setBusy(false); }
  };
  return (
    <section className="apple-card p-5 mb-6 mfa-settings" aria-labelledby="sessions-title">
      <header className="mfa-settings-header">
        <Monitor size={22} aria-hidden="true" /><h2 id="sessions-title">Phiên & bảo mật</h2>
        <button type="button" className="session-refresh" title="Làm mới" aria-label="Làm mới phiên và nhật ký" disabled={busy} onClick={load}><RefreshCw size={18} /></button>
      </header>
      <div className="apple-segmented session-tabs mt-4" role="group" aria-label="Thông tin bảo mật">
        <button type="button" aria-pressed={tab === 'sessions'} className={`apple-segment flex-1 ${tab === 'sessions' ? 'apple-segment-active' : ''}`} onClick={() => setTab('sessions')}>Phiên đăng nhập</button>
        <button type="button" aria-pressed={tab === 'events'} className={`apple-segment flex-1 ${tab === 'events' ? 'apple-segment-active' : ''}`} onClick={() => setTab('events')}>Nhật ký</button>
      </div>
      {error && <FeedbackBanner variant="error" className="mt-3">{error}</FeedbackBanner>}
      {busy && <p className="mfa-muted mt-3" role="status">Đang cập nhật...</p>}
      {tab === 'sessions' ? <>
        <p className="mfa-muted mt-3">Không hoạt động: 30 phút · Tối đa: 8 giờ</p>
        <ul className="session-list">{sessions.map((session) => <li key={session.id}>
          <div><strong>{session.browser} · {session.platform}</strong>{session.current && <span className="session-current">Phiên này</span>}
            <p className="mfa-muted">Hoạt động: {time(session.lastSeenAt)}</p><p className="mfa-muted">Hết hạn: {time(session.expiresAt)}</p></div>
          <button type="button" disabled={busy} className="session-revoke" title="Đăng xuất phiên này" aria-label={`Đăng xuất ${session.browser} ${session.platform}${session.current ? ' hiện tại' : ''}`} onClick={() => revoke(session.id)}><LogOut size={18} /></button>
        </li>)}</ul>
        {sessions.some((session) => !session.current) && <button type="button" disabled={busy} className="apple-btn-secondary w-full" onClick={() => revoke('others')}>Đăng xuất các phiên khác</button>}
      </> : <ul className="session-list">{events.length ? events.map((event) => <li key={event._id}>
        <div><strong>{eventNames[event.event] || 'Xác thực'}</strong><p className="mfa-muted">{time(event.createdAt)}</p></div><span className="mfa-muted">{outcomes[event.outcome]}</span>
      </li>) : <li className="mfa-muted">Chưa có sự kiện.</li>}</ul>}
    </section>
  );
}
