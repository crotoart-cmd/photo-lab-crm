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
    label: 'Shop Products',
    shortLabel: 'Kho',
    icon: 'inventory',
    tabIcon: 'intake',
    match: 'retail-intake',
  },
  {
    type: 'link',
    to: '/retail?tab=orders',
    label: 'Shop Products',
    shortLabel: 'Đơn',
    icon: 'shopping_bag',
    match: 'retail-orders',
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
    label: 'Shop Products',
    items: [
      {
        type: 'link',
        to: '/retail?tab=intake',
        label: 'Kho',
        icon: 'inventory',
        navIcon: 'intake',
        match: 'retail-intake',
      },
      {
        type: 'link',
        to: '/retail?tab=orders',
        label: 'Đơn',
        icon: 'shopping_bag',
        match: 'retail-orders',
      },
    ],
  },
  {
    id: 'lab',
    label: 'Vận hành lab',
    items: [
      { type: 'link', to: '/films', label: 'Phiếu film', icon: 'movie' },
      { type: 'link', to: '/repairs', label: 'Sửa máy khách', icon: 'build' },
    ],
  },
  {
    id: 'web',
    label: 'Website',
    items: [
      { type: 'link', to: '/noi-dung', label: 'Blog', icon: 'article', ownerOnly: true },
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
  const tab = params.get('tab') || 'intake';

  if (item.match === 'retail-intake') {
    return pathname === '/retail' && tab !== 'orders';
  }
  if (item.match === 'retail-orders') {
    return pathname === '/retail' && tab === 'orders';
  }
  if (item.end) {
    return pathname === item.to;
  }
  if (item.to?.includes('?')) {
    return pathname + search === item.to;
  }
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
