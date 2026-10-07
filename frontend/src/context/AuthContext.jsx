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
import { clearStaleServerAuth } from '../utils/authToken';

const AuthContext = createContext(null);
const MOBILE_LOGIN_TIMEOUT_MS = 2000;

function isOfflineAuthError(err) {
  if (!err?.response) return true;
  if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') return true;
  const status = err.response?.status;
  return status >= 502 && status <= 504;
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
    setUser(data.user);
    localStorage.setItem('user', JSON.stringify(data.user));
    const token = localStorage.getItem('token');
    if (token) rememberServerJwt(token);
    setOfflineSession(false);
    return data.user;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
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

  const tryUpgradeServerSession = (normalizedEmail, password) => {
    api
      .post('/auth/login', { email: normalizedEmail, password }, { timeout: MOBILE_LOGIN_TIMEOUT_MS })
      .then(async ({ data }) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        rememberServerJwt(data.token);
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
          { email: normalizedEmail, password },
          { timeout: MOBILE_LOGIN_TIMEOUT_MS }
        );
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        rememberServerJwt(data.token);
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
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    rememberServerJwt(data.token);
    setUser(data.user);
    setOfflineSession(false);
    return data;
  };

  const loginOfflineOnly = async (email, password) => {
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
    const saved = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!saved || !token) return false;
    setUser(JSON.parse(saved));
    setOfflineSession(true);
    return true;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearBackupJwt();
    setUser(null);
    setOfflineSession(false);
  };

  const isOwner = user?.role === 'owner';

  return (
    <AuthContext.Provider
      value={{
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
