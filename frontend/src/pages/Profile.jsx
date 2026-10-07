import { useEffect, useState } from 'react';
import api from '../api/client';
import { apiErrorMessage } from '../utils/apiError';
import { inputClass, labelClass, LabeledInput } from '../components/formFields';
import { useAuth } from '../context/AuthContext';
import { IosPage } from '../components/mobile';
import FeedbackBanner from '../components/FeedbackBanner';
import {
  getBackupSettings,
  buildLocalBackupPayload,
  getBackupMeta,
  getStorageSettings,
  isMobileDataEnabled,
  markBackupExported,
  pruneLocalData,
  saveBackupSettings,
  saveStorageSettings,
} from '../lib/mobileLocalDb';
import { backupToServer } from '../lib/mobileBackup';
import {
  getDeviceSmtpStatus,
  saveDeviceSmtpCredentials,
  clearDeviceSmtpCredentials,
  verifyDeviceSmtp,
  bootstrapDeviceSmtpFromBuild,
  capPluginErrorMessage,
  supportsDeviceSmtp,
} from '../lib/mobileDeviceEmail';
import { countLocalTestCameras } from '../lib/seedTestCameras';
import {
  seedLocalTestDataBundle,
  formatTestDataSeedToast,
} from '../lib/seedLocalTestBundle';

const emptyStaffForm = { name: '', email: '', password: '', phone: '' };

function readDashboardDisplayMeta() {
  try {
    const stored = JSON.parse(localStorage.getItem('nuocleo.dashboard.displayMeta') || '{}');
    const date = stored.date
      ? new Date(`${stored.date}T12:00:00`)
      : new Date();
    const updatedAt = stored.updatedAt ? new Date(stored.updatedAt) : null;
    return {
      date: date.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      updatedAt:
        updatedAt && !Number.isNaN(updatedAt.getTime())
          ? updatedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : null,
    };
  } catch {
    return {
      date: new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      updatedAt: null,
    };
  }
}

function SegmentPills({ options, value, onChange, formatLabel = (v) => String(v) }) {
  return (
    <div className="apple-segmented flex flex-wrap gap-1 w-full">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`apple-segment flex-1 min-w-[4.5rem] text-center ${
            value === opt ? 'apple-segment-active' : ''
          }`}
        >
          {formatLabel(opt)}
        </button>
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, isOwner, refreshUser, setUser } = useAuth();
  const [dashboardMeta] = useState(readDashboardDisplayMeta);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '' });
  const [staffList, setStaffList] = useState([]);
  const [staffSlotAvailable, setStaffSlotAvailable] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [storageSettings, setStorageSettings] = useState(() => getStorageSettings());
  const [backupSettings, setBackupSettings] = useState(() => getBackupSettings());
  const [backupMeta, setBackupMeta] = useState(() => getBackupMeta());
  const mobileStorageEnabled = isMobileDataEnabled();
  const [smtpStatus, setSmtpStatus] = useState({ configured: false, email: '' });
  const [smtpForm, setSmtpForm] = useState({ email: '', appPassword: '' });
  const [smtpAction, setSmtpAction] = useState(null); // 'bootstrap' | 'save' | 'verify' | 'clear'
  const [smtpHint, setSmtpHint] = useState('');
  const [testCamCount, setTestCamCount] = useState(() =>
    mobileStorageEnabled ? countLocalTestCameras() : 0
  );
  const showDeviceSmtp = mobileStorageEnabled && supportsDeviceSmtp();

  const handleSeedTestCameras = () => {
    try {
      const result = seedLocalTestDataBundle();
      setTestCamCount(countLocalTestCameras());
      setSuccess(formatTestDataSeedToast(result));
      setError('');
    } catch (err) {
      setError(err.message || 'Nạp dữ liệu test thất bại');
    }
  };

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', email: user.email || '', password: '' });
    }
  }, [user]);

  const loadUsers = async () => {
    if (!isOwner) return;
    const { data } = await api.get('/users');
    setStaffList((data.users || []).filter((u) => u.role === 'staff'));
    setStaffSlotAvailable(Boolean(data.staffSlotAvailable));
  };

  useEffect(() => {
    if (isOwner) {
      loadUsers().catch(() => {});
    }
  }, [isOwner]);

  useEffect(() => {
    if (!showDeviceSmtp) return;
    let cancelled = false;
    (async () => {
      setSmtpAction('bootstrap');
      setSmtpHint('Đang kiểm tra cấu hình SMTP trên máy…');
      try {
        const boot = await bootstrapDeviceSmtpFromBuild();
        const s = await getDeviceSmtpStatus();
        if (cancelled) return;
        setSmtpStatus(s);
        const preset =
          s.email ||
          import.meta.env.VITE_DEVICE_SMTP_EMAIL ||
          'nuocleosaigon@gmail.com';
        setSmtpForm((f) => ({ ...f, email: preset }));
        if (s.pluginMissing) {
          setError('Plugin email chưa sẵn sàng — cần cài lại bản app mới nhất');
          setSmtpHint('');
        } else if (s.error) {
          setError(s.error);
          setSmtpHint('');
        } else if (s.configured) {
          setSuccess('SMTP đã lưu trên máy');
          setSmtpHint(`Đang dùng ${s.email || preset}`);
        } else if (boot.reason === 'no-build-config') {
          setSmtpHint('Nhập App Password rồi bấm Lưu trên máy');
        } else if (!boot.ok) {
          setSmtpHint(boot.reason || 'Chưa lưu SMTP — nhập App Password');
        } else {
          setSmtpHint('Chưa lưu SMTP — nhập App Password');
        }
      } catch (err) {
        if (!cancelled) {
          setError(capPluginErrorMessage(err, 'Không đọc được trạng thái SMTP'));
          setSmtpHint('');
        }
      } finally {
        if (!cancelled) setSmtpAction(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showDeviceSmtp]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const payload = {
        name: profileForm.name.trim(),
      };
      if (isOwner && profileForm.email.trim()) {
        payload.email = profileForm.email.trim();
      }
      if (profileForm.password) payload.password = profileForm.password;

      const { data } = await api.patch('/auth/profile', payload);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      await refreshUser?.();
      setProfileForm((f) => ({ ...f, password: '' }));
      setSuccess('Đã lưu hồ sơ');
    } catch (err) {
      setError(apiErrorMessage(err, 'Lưu hồ sơ thất bại'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/users', staffForm);
      setStaffForm(emptyStaffForm);
      setShowStaffForm(false);
      setSuccess('Đã tạo tài khoản nhân viên');
      await loadUsers();
    } catch (err) {
      setError(apiErrorMessage(err, 'Tạo nhân viên thất bại'));
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = isOwner ? 'Chủ hệ thống (toàn quyền)' : 'Nhân viên';

  const handleRetentionChange = (months) => {
    const next = saveStorageSettings({ retentionMonths: months });
    setStorageSettings(next);
    const pruned = pruneLocalData({ retentionMonths: next.retentionMonths });
    setSuccess(
      `Đã lưu chính sách ${next.retentionMonths} tháng (dọn ${pruned.removedSales} giao dịch cũ)`
    );
  };

  const handleExportBackup = () => {
    try {
      const payload = buildLocalBackupPayload();
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nuocleo-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      markBackupExported();
      const meta = getBackupMeta();
      setBackupMeta(meta);
      setSuccess('Đã xuất file backup. Bạn có thể lưu lên iCloud/Drive.');
    } catch (err) {
      setError(err?.message || 'Xuất backup thất bại');
    }
  };

  const handleBackupNowToServer = async () => {
    try {
      setLoading(true);
      await backupToServer('manual');
      const meta = getBackupMeta();
      setBackupMeta(meta);
      setSuccess('Đã backup dữ liệu lên server.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Backup server thất bại'));
    } finally {
      setLoading(false);
    }
  };

  const handleAutoBackupToggle = (enabled) => {
    const next = saveBackupSettings({ autoBackupEnabled: enabled });
    setBackupSettings(next);
    setSuccess(enabled ? 'Đã bật backup tự động' : 'Đã tắt backup tự động');
  };

  const handleAutoBackupHours = (hours) => {
    const next = saveBackupSettings({ autoBackupHours: hours });
    setBackupSettings(next);
    setSuccess(`Đã đặt chu kỳ backup tự động mỗi ${next.autoBackupHours} giờ`);
  };

  const handleSmtpSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSmtpAction('save');
    setSmtpHint('Đang lưu trên máy…');
    try {
      await saveDeviceSmtpCredentials(smtpForm.email, smtpForm.appPassword);
      const status = await getDeviceSmtpStatus();
      setSmtpStatus(status);
      setSmtpForm((f) => ({ ...f, appPassword: '' }));
      setSuccess('Đã lưu Gmail App Password trên máy');
      setSmtpHint(`Đang dùng ${status.email || smtpForm.email}`);
    } catch (err) {
      setError(capPluginErrorMessage(err, 'Lưu SMTP thất bại'));
      setSmtpHint('');
    } finally {
      setSmtpAction(null);
    }
  };

  const handleSmtpVerify = async () => {
    setError('');
    setSuccess('');
    setSmtpAction('verify');
    setSmtpHint('Đang gửi email thử qua Gmail (có thể mất ~15 giây)…');
    try {
      const result = await verifyDeviceSmtp();
      setSuccess(result.message || 'Đã gửi email thử thành công');
      setSmtpHint(`Đang dùng ${smtpStatus.email || smtpForm.email}`);
    } catch (err) {
      setError(capPluginErrorMessage(err, 'Kiểm tra SMTP thất bại'));
      setSmtpHint('');
    } finally {
      setSmtpAction(null);
    }
  };

  const handleSmtpClear = async () => {
    setError('');
    setSuccess('');
    setSmtpAction('clear');
    try {
      await clearDeviceSmtpCredentials();
      setSmtpStatus({ configured: false });
      setSmtpForm({ email: smtpForm.email, appPassword: '' });
      setSuccess('Đã xóa cấu hình SMTP trên máy');
      setSmtpHint('Chưa lưu SMTP — nhập App Password');
    } catch (err) {
      setError(capPluginErrorMessage(err, 'Xóa SMTP thất bại'));
    } finally {
      setSmtpAction(null);
    }
  };

  return (
    <IosPage>
    <div className="profile-page mx-auto w-full max-w-xl">
      <header className="mb-6">
        <h1 className="apple-page-title">Hồ sơ & tài khoản</h1>
        <p className="apple-page-subtitle">{dashboardMeta.date}</p>
        {dashboardMeta.updatedAt && (
          <p className="text-xs text-[var(--color-label-tertiary)] mt-1">
            Dashboard cập nhật lúc {dashboardMeta.updatedAt}
          </p>
        )}
      </header>

      {error && <FeedbackBanner variant="error" className="mb-3">{error}</FeedbackBanner>}
      {success && <FeedbackBanner variant="success" className="mb-3">{success}</FeedbackBanner>}

      {mobileStorageEnabled && (
        <section className="apple-card p-5 mb-6">
          <h2 className="font-semibold text-[var(--color-label)] mb-1">Dữ liệu test</h2>
          <p className="text-xs text-[var(--color-label-secondary)] mb-3">
            Nạp 10 máy ảnh film mẫu (serial <strong>TEST-*</strong>) và đơn bán demo (~14 ngày) trên
            máy — thử bán / quét mã / xem biểu đồ Dashboard. Không cần Mac.
          </p>
          <p className="text-sm text-[var(--color-label)] mb-3">
            Đã có trên máy: <strong>{testCamCount}</strong>/10 máy test
          </p>
          <button
            type="button"
            onClick={handleSeedTestCameras}
            className="apple-btn-secondary btn-pill--block w-full"
          >
            Nạp dữ liệu test (máy + đơn bán)
          </button>
          <p className="text-[11px] text-[var(--color-label-secondary)] mt-2">
            Hoặc vào tab <strong>Bán hàng</strong> / <strong>Nhập hàng</strong> — cùng nút nạp này.
          </p>
        </section>
      )}

      <section className="apple-card p-5 mb-6">
        <p className="text-xs font-semibold text-[var(--color-blue)] uppercase mb-3 tracking-wide">{roleLabel}</p>
        <form onSubmit={handleProfileSave} className="space-y-3">
          <LabeledInput
            label="Họ tên"
            required
            value={profileForm.name}
            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
          />
          <div>
            <label className={labelClass}>Email đăng nhập</label>
            <input
              type="email"
              className={inputClass}
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              disabled={!isOwner}
              required={isOwner}
            />
            {!isOwner && (
              <p className="text-[10px] text-[var(--color-label-secondary)] mt-1">Chỉ chủ hệ thống được đổi email.</p>
            )}
          </div>
          <LabeledInput
            label="Mật khẩu mới"
            type="password"
            placeholder="Để trống nếu không đổi"
            value={profileForm.password}
            onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
            minLength={6}
          />
          <button
            type="submit"
            disabled={loading}
            className="apple-btn-primary btn-pill--block w-full"
          >
            {loading ? 'Đang lưu...' : 'Lưu hồ sơ'}
          </button>
        </form>
      </section>

      {showDeviceSmtp && (
        <section className="apple-card p-5 mb-6">
          <h2 className="font-semibold text-[var(--color-label)] mb-1">Gửi email từ máy</h2>
          <p className="text-xs text-[var(--color-label-secondary)] mb-4">
            Phiếu bán gửi tự động ngay khi xác nhận — không cần Mac bật. Dùng{' '}
            <strong>Gmail App Password</strong> (16 ký tự), lưu mã hóa trên thiết bị
            (iPhone Keychain / Android EncryptedSharedPreferences).
            <br />
            <span className="text-[var(--color-label-secondary)]">
              Nút <strong>Kiểm tra</strong> gửi thử về hộp Gmail shop. Khi bán, phiếu gửi tới{' '}
              <strong>email khách</strong> trên màn thanh toán (shop nhận bản sao BCC).
            </span>
          </p>

          {smtpStatus.configured && (
            <p className="apple-alert-success mb-4">
              Đang dùng: <strong>{smtpStatus.email}</strong>
            </p>
          )}

          {smtpHint && (
            <p className="apple-alert-info mb-4">{smtpHint}</p>
          )}

          <form onSubmit={handleSmtpSave} className="space-y-3">
            <LabeledInput
              label="Gmail gửi đi"
              type="email"
              required
              placeholder="nuocleosaigon@gmail.com"
              value={smtpForm.email}
              onChange={(e) => setSmtpForm({ ...smtpForm, email: e.target.value })}
            />
            <div>
              <label className={labelClass}>App Password (16 ký tự)</label>
              <input
                type="password"
                className={inputClass}
                placeholder={smtpStatus.configured ? 'Nhập mới để thay' : 'xxxx xxxx xxxx xxxx'}
                value={smtpForm.appPassword}
                onChange={(e) => setSmtpForm({ ...smtpForm, appPassword: e.target.value })}
                autoComplete="off"
                required={!smtpStatus.configured}
              />
              <p className="text-[10px] text-[var(--color-label-secondary)] mt-1">
                Tạo tại Google Account → Bảo mật → Xác minh 2 bước → App Passwords.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="submit"
                disabled={smtpAction === 'save' || smtpAction === 'bootstrap'}
                className="apple-btn-primary btn-pill--block w-full"
              >
                {smtpAction === 'save' ? 'Đang lưu...' : 'Lưu trên máy'}
              </button>
              <button
                type="button"
                onClick={handleSmtpVerify}
                disabled={smtpAction != null || !smtpStatus.configured}
                className="apple-btn-secondary btn-pill--block w-full"
              >
                {smtpAction === 'verify' ? 'Đang gửi...' : 'Kiểm tra gửi'}
              </button>
              <button
                type="button"
                onClick={handleSmtpClear}
                disabled={smtpAction != null || !smtpStatus.configured}
                className="apple-btn-destructive btn-pill--block w-full justify-center"
              >
                {smtpAction === 'clear' ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </form>
        </section>
      )}

      {mobileStorageEnabled && (
        <section className="apple-card p-5 mb-6">
          <h2 className="font-semibold text-[var(--color-label)] mb-1">Lưu trữ offline & backup</h2>
          <p className="text-xs text-[var(--color-label-secondary)] mb-4">
            App chạy độc lập trên mobile. Chọn thời gian giữ dữ liệu để cân bằng hiệu năng.
          </p>

          <div className="mb-4">
            <p className="text-xs font-semibold text-[var(--color-label-secondary)] uppercase mb-2 tracking-wide">
              Giữ dữ liệu trên máy
            </p>
            <SegmentPills
              options={[6, 12, 24]}
              value={storageSettings.retentionMonths}
              onChange={handleRetentionChange}
              formatLabel={(m) => `${m} tháng`}
            />
          </div>

          <div className="apple-card-filled p-3 mb-3">
            <p className="text-sm text-[var(--color-label)]">
              Lần backup gần nhất:{' '}
              <strong>
                {backupMeta?.exportedAt
                  ? new Date(backupMeta.exportedAt).toLocaleString('vi-VN')
                  : 'Chưa có'}
              </strong>
            </p>
            <p className="text-sm text-[var(--color-label)] mt-1">
              Backup server:{' '}
              <strong>
                {backupMeta?.serverBackupAt
                  ? new Date(backupMeta.serverBackupAt).toLocaleString('vi-VN')
                  : 'Chưa có'}
              </strong>
            </p>
          </div>

          <div className="apple-card-filled p-3 mb-3">
            <p className="text-xs font-semibold text-[var(--color-label-secondary)] uppercase mb-2 tracking-wide">
              Backup tự động
            </p>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--color-label)] mb-2">
              <input
                type="checkbox"
                checked={backupSettings.autoBackupEnabled}
                onChange={(e) => handleAutoBackupToggle(e.target.checked)}
              />
              Bật backup tự động khi online
            </label>
            <SegmentPills
              options={[6, 12, 24]}
              value={backupSettings.autoBackupHours}
              onChange={handleAutoBackupHours}
              formatLabel={(h) => `${h} giờ`}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleBackupNowToServer}
              disabled={loading}
              className="apple-btn-primary btn-pill--block w-full"
            >
              Backup ngay lên server
            </button>
            <button
              type="button"
              onClick={handleExportBackup}
              className="apple-btn-secondary btn-pill--block w-full"
            >
              Xuất backup JSON
            </button>
          </div>
        </section>
      )}

      {isOwner && (
        <section className="apple-card p-5">
          <h2 className="font-semibold text-[var(--color-label)] mb-1">Nhân viên thứ 2</h2>
          <p className="text-xs text-[var(--color-label-secondary)] mb-4">
            Quyền thấp hơn — không đổi email chủ, không tạo thêm user.
          </p>

          {staffList.length === 0 ? (
            <p className="text-sm text-[var(--color-label-secondary)] apple-card-filled px-3 py-3 border border-dashed border-[var(--color-separator)]">
              Chưa có nhân viên — tạo khi cần (còn {staffSlotAvailable ? '1 slot' : '0 slot'}).
            </p>
          ) : (
            <ul className="space-y-2 mb-4">
              {staffList.map((s) => (
                <li
                  key={s.id}
                  className="text-sm rounded-xl px-3 py-2 border border-[var(--color-separator)] bg-[var(--color-bg-secondary)]"
                >
                  <p className="font-medium text-[var(--color-label)]">{s.name}</p>
                  <p className="text-xs text-[var(--color-label-secondary)]">{s.email}</p>
                </li>
              ))}
            </ul>
          )}

          {staffSlotAvailable && !showStaffForm && (
            <button
              type="button"
              onClick={() => setShowStaffForm(true)}
              className="apple-btn-ghost !px-0 text-sm"
            >
              + Tạo tài khoản nhân viên
            </button>
          )}

          {showStaffForm && (
            <form
              onSubmit={handleCreateStaff}
              className="space-y-3 mt-4 pt-4 border-t border-[var(--color-separator)]"
            >
              <LabeledInput
                label="Họ tên nhân viên"
                required
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
              />
              <LabeledInput
                label="Email"
                type="email"
                required
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              />
              <LabeledInput
                label="Mật khẩu"
                type="password"
                required
                minLength={6}
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 apple-btn-primary"
                >
                  Tạo nhân viên
                </button>
                <button
                  type="button"
                  onClick={() => setShowStaffForm(false)}
                  className="apple-btn-secondary px-4"
                >
                  Hủy
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
    </IosPage>
  );
}
