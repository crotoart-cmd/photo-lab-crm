import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavDrawer from './NavDrawer';
import MobileNavBar from './MobileNavBar';
import MobileTabBar from './MobileTabBar';
import RouteErrorBoundary from './RouteErrorBoundary';

function useMobileShellMetrics(chromeRef, tabBarRef) {
  useEffect(() => {
    const chromeEl = chromeRef.current;
    const tabEl = tabBarRef.current;
    if (!chromeEl && !tabEl) return undefined;

    const sync = () => {
      const root = document.documentElement;
      const mobileShell =
        root.classList.contains('mobile-app') ||
        window.matchMedia('(max-width: 767px)').matches;
      if (mobileShell) {
        if (chromeEl) {
          root.style.setProperty('--ios-chrome-offset', `${chromeEl.offsetHeight}px`);
        }
        if (tabEl) {
          root.style.setProperty('--ios-tab-bar-offset', `${tabEl.offsetHeight}px`);
        }
      } else {
        root.style.removeProperty('--ios-chrome-offset');
        root.style.removeProperty('--ios-tab-bar-offset');
      }
    };

    sync();
    const ro = new ResizeObserver(sync);
    if (chromeEl) ro.observe(chromeEl);
    if (tabEl) ro.observe(tabEl);
    window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [chromeRef, tabBarRef]);
}

export default function Layout() {
  const { user, logout, isOwner } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const chromeRef = useRef(null);
  const tabBarRef = useRef(null);
  useMobileShellMetrics(chromeRef, tabBarRef);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className="ios-app-layout ios-app-shell min-h-screen flex">
        <NavDrawer user={user} isOwner={isOwner} onLogout={handleLogout} />
        <div className="ios-mobile-frame flex-1 flex flex-col min-w-0 min-h-0 w-full">
          <div ref={chromeRef} className="ios-mobile-chrome desktop-chrome-contents">
            <MobileNavBar
              user={user}
              isOwner={isOwner}
              onLogout={handleLogout}
              open={mobileMenuOpen}
              onOpenChange={setMobileMenuOpen}
            />
          </div>
          <main className="mobile-app-main flex-1 min-h-0 desktop-main-pad">
            <RouteErrorBoundary key={`${location.pathname}${location.search}`}>
              <Outlet />
            </RouteErrorBoundary>
          </main>
        </div>
      </div>
      <MobileTabBar ref={tabBarRef} />
    </>
  );
}
