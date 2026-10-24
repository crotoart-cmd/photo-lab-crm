import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import {
  saveOfflineCredentials,
  verifyOfflineLogin,
  bootstrapOfflineLogin,
  readOfflineCredentials,
  restoreOfflineSessionFromSavedUser,
} from '../lib/mobileOfflineAuth';
import { rememberServerJwt, clearBackupJwt } from '../lib/mobileServerLink';
import { clearStaleServerAuth, getServerAuthToken } from '../utils/authToken';
import { isCrmHost } from '../config/siteHosts';
import { hasRecentAdminActivity, trackAdminActivity, SESSION_DEADLINE_EVENT } from '../lib/adminSessionActivity';

const AuthContext = createContext(null);
const MOBILE_LOGIN_TIMEOUT_MS = 2000;

function isOfflineAuthError(err) {
  if (!err?.response) return true;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  const status = err.response?.status;
  return status >= 502 && status <= 504;
}

function persistServerUser(user, token) {
  localStorage.setItem('user', JSON.stringify(user));
  if (isMobileDataEnabled() && token) {
    localStorage.setItem('token', token);
    rememberServerJwt(token);
  } else {
    localStorage.removeItem('token');
  }
}

function applyOfflineSession(setUser, setOfflineSession, user, token) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  setUser(user);
  setOfflineSession(true);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  const [offlineSession, setOfflineSession] = useState(false);

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    persistServerUser(data.user, data.token || localStorage.getItem('token'));
    setUser(data.user);
    setOfflineSession(false);
    return data.user;
  };

  useEffect(() => {
    const token = isMobileDataEnabled() ? localStorage.getItem('token') : null;
    if (!isMobileDataEnabled()) localStorage.removeItem('token');
    if (!isCrmHost()) {
      setLoading(false);
      return;
    }
    if (!token && !isMobileDataEnabled()) {
      refreshUser()
        .catch((err) => {
          localStorage.removeItem('user');
          setUser(null);
        })
        .finally(() => setLoading(false));
      return;
    }
    if (!token) {
      setLoading(false);
      return;
    }

    const saved = localStorage.getItem('user');

    // Mobile: vào app ngay bằng phiên local, không chờ server (4G không tới Mac).
    if (isMobileDataEnabled() && saved) {
      setUser(JSON.parse(saved));
      setOfflineSession(token.startsWith('offline.') || true);
      setLoading(false);

      if (token.startsWith('offline.')) return;

      refreshUser()
        .then(() => setOfflineSession(false))
        .catch((err) => {
          if (err.response?.status === 401) {
            clearStaleServerAuth();
            const restored = restoreOfflineSessionFromSavedUser();
            if (restored) {
              applyOfflineSession(setUser, setOfflineSession, restored.user, restored.token);
              return;
            }
            localStorage.removeItem('user');
            setUser(null);
            setOfflineSession(false);
            return;
          }
          setOfflineSession(true);
        });
      return;
    }

    refreshUser()
      .catch((err) => {
        if (err.response?.status === 401) {
          clearStaleServerAuth();
          if (isMobileDataEnabled()) {
            const restored = restoreOfflineSessionFromSavedUser();
            if (restored) {
              applyOfflineSession(setUser, setOfflineSession, restored.user, restored.token);
              return;
            }
          }
          localStorage.removeItem('user');
          setUser(null);
          setOfflineSession(false);
          return;
        }
        if (isMobileDataEnabled() && isOfflineAuthError(err) && saved) {
          setUser(JSON.parse(saved));
          setOfflineSession(true);
          return;
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setOfflineSession(false);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id || isMobileDataEnabled() || !isCrmHost() || offlineSession) return;
    let stopped = false, pending = false, lastPulse = 0, expiryTimer;
    const expire = () => {
      localStorage.removeItem('user'); localStorage.removeItem('token');
      setUser(null); setOfflineSession(false);
      window.location.href = '/login?reason=expired';
    };
    const deadline = (event) => {
      const at = Math.min(event.detail.expiresAt, event.detail.idleExpiresAt);
      if (!Number.isFinite(at)) return;
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(expire, Math.max(0, at - Date.now()));
    };
    const pulse = () => {
      if (stopped || pending || !hasRecentAdminActivity() || Date.now() - lastPulse < 60000) return;
      lastPulse = Date.now(); pending = true;
      api.get('/auth/me').catch(() => {}).finally(() => { pending = false; });
    };
    window.addEventListener(SESSION_DEADLINE_EVENT, deadline);
    const stopTracking = trackAdminActivity(pulse);
    const heartbeat = setInterval(pulse, 60000);
    pulse();
    return () => {
      stopped = true; stopTracking(); clearInterval(heartbeat); clearTimeout(expiryTimer);
      window.removeEventListener(SESSION_DEADLINE_EVENT, deadline);
    };
  }, [user?.id, offlineSession]);

  const tryUpgradeServerSession = (normalizedEmail, password) => {
    api
      .post(
        '/auth/login',
        { email: normalizedEmail, password, client: 'mobile' },
        { timeout: MOBILE_LOGIN_TIMEOUT_MS }
      )
      .then(async ({ data }) => {
        if (data.requiresMfa) return;
        persistServerUser(data.user, data.token);
        setUser(data.user);
        setOfflineSession(false);
        await saveOfflineCredentials(normalizedEmail, password, data.user);
      })
      .catch(() => {});
  };

  const login = async (email, password) => {
    const normalizedEmail = String(email).trim().toLowerCase();

    // Tablet / iPhone = nguồn chính: vào app bằng phiên local trước, Mac chỉ sync nền.
    if (isMobileDataEnabled()) {
      const creds = readOfflineCredentials();
      if (creds?.email === normalizedEmail) {
        const offline = await verifyOfflineLogin(normalizedEmail, password);
        if (offline) {
          applyOfflineSession(setUser, setOfflineSession, offline.user, offline.token);
          tryUpgradeServerSession(normalizedEmail, password);
          return { ...offline, offlineBootstrap: false };
        }
        const wrong = new Error('Mật khẩu không đúng');
        wrong.code = 'OFFLINE_WRONG_PASSWORD';
        throw wrong;
      }

      try {
        return await loginOfflineOnly(normalizedEmail, password);
      } catch (offlineErr) {
        if (offlineErr?.code === 'OFFLINE_WRONG_PASSWORD' || offlineErr?.code === 'OFFLINE_SETUP_FAILED') {
          throw offlineErr;
        }
      }

      try {
        const { data } = await api.post(
          '/auth/login',
          { email: normalizedEmail, password, client: 'mobile' },
          { timeout: MOBILE_LOGIN_TIMEOUT_MS }
        );
        if (data.requiresMfa) return data;
        persistServerUser(data.user, data.token);
        setUser(data.user);
        setOfflineSession(false);
        await saveOfflineCredentials(normalizedEmail, password, data.user);
        return data;
      } catch (err) {
        if (!isOfflineAuthError(err)) throw err;
        return loginOfflineOnly(normalizedEmail, password);
      }
    }

    const { data } = await api.post('/auth/login', { email: normalizedEmail, password });
    if (data.requiresMfa) return data;
    persistServerUser(data.user, data.token);
    setUser(data.user);
    setOfflineSession(false);
    return data;
  };

  const loginOfflineOnly = async (email, password) => {
    if (!isMobileDataEnabled()) throw new Error('Admin web cần xác thực với máy chủ.');
    const normalizedEmail = String(email).trim().toLowerCase();

    const offline = await verifyOfflineLogin(normalizedEmail, password);
    if (offline) {
      applyOfflineSession(setUser, setOfflineSession, offline.user, offline.token);
      tryUpgradeServerSession(normalizedEmail, password);
      return { ...offline, offlineBootstrap: false };
    }

    const creds = readOfflineCredentials();
    if (creds && creds.email === normalizedEmail) {
      const wrong = new Error('Mật khẩu không đúng');
      wrong.code = 'OFFLINE_WRONG_PASSWORD';
      throw wrong;
    }

    const boot = await bootstrapOfflineLogin(normalizedEmail, password);
    if (boot) {
      applyOfflineSession(setUser, setOfflineSession, boot.user, boot.token);
      tryUpgradeServerSession(normalizedEmail, password);
      return { ...boot, offlineBootstrap: boot.firstSetup };
    }

    const fail = new Error('Không thể thiết lập offline');
    fail.code = 'OFFLINE_SETUP_FAILED';
    throw fail;
  };

  const continueOffline = () => {
    if (!isMobileDataEnabled()) return false;
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!saved || !token) return false;
    setUser(JSON.parse(saved));
    setOfflineSession(true);
    return true;
  };

  const logout = () => {
    const serverToken = getServerAuthToken();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearBackupJwt();
    api.post('/auth/logout', {}, {
      headers: serverToken ? { Authorization: `Bearer ${serverToken}` } : {},
    }).catch(() => {});
    setUser(null);
    setOfflineSession(false);
  };

  const completeMfaLogin = async (challengeToken, code) => {
    const { data } = await api.post('/auth/mfa/login', { challengeToken, code });
    persistServerUser(data.user, data.token);
    setUser(data.user);
    setOfflineSession(false);
    return data;
  };

  const isOwner = user?.role === 'owner';

  return (
    <AuthContext.Provider
      value={{
        completeMfaLogin,
        user,
        setUser,
        loading,
        login,
        loginOfflineOnly,
        logout,
        refreshUser,
        continueOffline,
        offlineSession,
        isAuthenticated: Boolean(user),
        isOwner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
