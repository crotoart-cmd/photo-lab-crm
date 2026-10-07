import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { initIosShell } from './lib/iosDevice';
import { initMobileAutoSync } from './lib/mobileSync';
import { bootstrapDeviceSmtpFromBuild } from './lib/mobileDeviceEmail';
import './index.css';

initIosShell();

if (import.meta.env.VITE_MOBILE_APP === 'true' || window.Capacitor?.isNativePlatform?.()) {
  document.documentElement.classList.add('mobile-app', 'capacitor-app');
  document.body.classList.add('mobile-app', 'capacitor-app');
  initMobileAutoSync();
  bootstrapDeviceSmtpFromBuild()
    .then((r) => {
      if (r.ok && r.configured !== false) return;
      if (r.reason === 'plugin-missing') {
        console.warn('[SMTP] plugin DeviceSmtp chưa sẵn sàng');
      }
    })
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
