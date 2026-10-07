/**
 * Nhận diện iOS / iPhone 14 Pro Max và gắn class lên <html> cho CSS shell.
 * iPhone 14 Pro Max: 430×932 pt, Dynamic Island, safe-area top ~59px, bottom ~34px.
 */

const IPHONE_14_PRO_MAX = { width: 430, height: 932 };

export function isCapacitorIos() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'ios';
}

export function isCapacitorAndroid() {
  return typeof window !== 'undefined' && window.Capacitor?.getPlatform?.() === 'android';
}

export function isCapacitorNative() {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

export function isIosUserAgent() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function matchesIphone14ProMaxScreen() {
  const w = window.screen?.width ?? 0;
  const h = window.screen?.height ?? 0;
  const min = Math.min(w, h);
  const max = Math.max(w, h);
  return min >= 428 && min <= 432 && max >= 926 && max <= 936;
}

export function initIosShell() {
  const html = document.documentElement;
  const params = new URLSearchParams(window.location.search);
  const forcePreview = params.get('ios') === 'iphone14promax';
  const mobileBuild = import.meta.env.VITE_MOBILE_APP === 'true';
  const native = isCapacitorIos();
  const android = isCapacitorAndroid();
  const iosUa = isIosUserAgent();

  if (mobileBuild || native || isCapacitorNative()) {
    html.classList.add('mobile-app', 'capacitor-app');
  }
  if (android) {
    html.classList.add('android-device');
    if (window.matchMedia('(min-width: 600px)').matches) {
      html.classList.add('android-tablet');
    }
  }
  if (native) html.classList.add('ios-native');
  // Android native kế thừa cùng token shell iOS (header / tab / surface).
  if (iosUa || native || android || forcePreview || isCapacitorNative()) {
    html.classList.add('ios-device');
  }

  // Shell iPhone Pro Max: iOS / preview / web mobile + Android native (Y700).
  if (
    forcePreview ||
    native ||
    android ||
    mobileBuild ||
    matchesIphone14ProMaxScreen()
  ) {
    html.classList.add('iphone-14-pro-max');
  }

  const narrowMq = window.matchMedia('(max-width: 430px)');
  const mobileMq = window.matchMedia('(max-width: 767px)');
  const applyViewport = () => {
    html.classList.toggle('iphone-viewport', narrowMq.matches);
    if (android || (mobileMq.matches && (iosUa || native || mobileBuild))) {
      html.classList.add('ios-device');
    }
  };
  applyViewport();
  narrowMq.addEventListener('change', applyViewport);
  mobileMq.addEventListener('change', applyViewport);

  if (forcePreview) {
    html.style.setProperty('--ios-preview', '1');
    // Khi chạy trong iframe giả lập (iphone.html), khung đã vẽ Dynamic Island
    // + home indicator → ẩn island giả của app để không bị chồng đôi.
    try {
      if (window.self !== window.top) html.classList.add('ios-preview-embedded');
    } catch {
      html.classList.add('ios-preview-embedded');
    }
  }

  initNativeStatusBar();
}

async function initNativeStatusBar() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!cap?.isNativePlatform?.() || cap.getPlatform?.() !== 'ios') return;

  const StatusBar = cap.Plugins?.StatusBar;
  if (!StatusBar) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: 'DARK' });
  } catch {
    /* plugin optional */
  }
}

export { IPHONE_14_PRO_MAX };
