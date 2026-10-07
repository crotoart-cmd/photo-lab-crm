/**
 * Cụm menu Navigation Drawer — Material Design 3
 * https://m3.material.io/components/navigation-drawer
 */

/** Tab bar dưới cùng — mobile / iOS */
export const MOBILE_TAB_ITEMS = [
  {
    type: 'link',
    to: '/',
    end: true,
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    icon: 'grid_view',
    tabIcon: 'overview',
  },
  {
    type: 'link',
    to: '/retail?tab=intake',
    label: 'Nhập hàng',
    shortLabel: 'Nhập',
    icon: 'inventory',
    tabIcon: 'intake',
    match: 'retail-intake',
  },
  {
    type: 'link',
    to: '/retail?tab=sale',
    label: 'Bán hàng',
    shortLabel: 'Bán',
    icon: 'barcode_scanner',
    tabIcon: 'sale',
    match: 'retail-sale',
  },
];

export const NAV_GROUPS = [
  {
    id: 'overview',
    label: 'Dashboard',
    items: [
      { type: 'link', to: '/', end: true, label: 'Dashboard', icon: 'dashboard', navIcon: 'overview' },
    ],
  },
  {
    id: 'retail',
    label: 'Kho & bán lẻ',
    items: [
      {
        type: 'link',
        to: '/retail?tab=intake',
        label: 'Nhập hàng',
        icon: 'inventory',
        navIcon: 'intake',
        match: 'retail-intake',
      },
      {
        type: 'link',
        to: '/retail?tab=sale',
        label: 'Bán hàng — Scan',
        icon: 'barcode_scanner',
        navIcon: 'sale',
        match: 'retail-sale',
      },
    ],
  },
  {
    id: 'lab',
    label: 'Vận hành lab',
    items: [
      { type: 'link', to: '/films', label: 'Phiếu film', icon: 'movie' },
      { type: 'link', to: '/repairs', label: 'Sửa máy khách', icon: 'build' },
      { type: 'link', to: '/inventory', label: 'Thuốc Tráng', icon: 'science' },
    ],
  },
  {
    id: 'customers',
    label: 'Quản lý khách hàng',
    items: [
      { type: 'link', to: '/customers', label: 'Khách hàng', icon: 'groups', navIcon: 'customer' },
    ],
  },
  {
    id: 'account',
    label: 'Tài khoản',
    items: [{ type: 'link', to: '/profile', label: 'Hồ sơ', icon: 'person' }],
  },
];

export function isNavItemActive(item, location) {
  const { pathname, search } = location;
  const params = new URLSearchParams(search);
  const tab = params.get('tab') || 'sale';

  if (item.match === 'retail-intake') {
    return pathname === '/retail' && tab === 'intake';
  }
  if (item.match === 'retail-sale') {
    return pathname === '/retail' && (tab === 'sale' || tab === 'pos');
  }
  if (item.end) {
    return pathname === item.to;
  }
  if (item.to?.includes('?')) {
    return pathname + search === item.to;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
