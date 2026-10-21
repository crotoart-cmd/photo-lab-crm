import api from '../api/client';
import { isMobileDataEnabled, loadCustomerRepairs, loadLabFilms } from './mobileLocalDb';
import { FILM_LAB_DATA_CHANGED } from './mobileFilmLabBridge';
import { REPAIR_DATA_CHANGED } from './mobileRepairBridge';
import { WEB_INBOX_CHANGED, WEB_INBOX_PING_KEY } from './webInboxPing';

export { pingWebInbox, WEB_INBOX_CHANGED, WEB_INBOX_PING_KEY } from './webInboxPing';

function filmCustomerName(film) {
  const c = film.customerId;
  if (c && typeof c === 'object') {
    return `${c.firstName || ''} ${c.lastName || ''}`.trim();
  }
  return '';
}

export function buildLocalWebInbox() {
  const films = loadLabFilms().filter((f) => f.status === 'web_order');
  const repairs = loadCustomerRepairs().filter((t) => t.status === 'don_web');

  const filmItems = films.map((film) => ({
    kind: 'film',
    id: String(film._id),
    code: film.ticketNumber || film.filmCode,
    title: 'Tráng film',
    customer: filmCustomerName(film) || 'Khách web',
    createdAt: film.createdAt,
    href: `/films?tab=receive&id=${film._id}`,
  }));

  const repairItems = repairs.map((ticket) => ({
    kind: 'repair',
    id: String(ticket._id),
    code: ticket.ticket_number,
    title: ticket.model_name || 'Sửa máy',
    customer: ticket.customer_name || 'Khách web',
    createdAt: ticket.createdAt,
    href: `/repairs?status=don_web&id=${ticket._id}`,
  }));

  const items = [...filmItems, ...repairItems]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 16);

  return {
    filmCount: films.length,
    repairCount: repairs.length,
    shopCount: 0,
    printCount: 0,
    scanCount: 0,
    total: films.length + repairs.length,
    items,
  };
}

export async function fetchWebInbox() {
  try {
    const { data } = await api.get('/dashboard/web-inbox');
    if (data && typeof data.total === 'number') return data;
  } catch {
    /* fallback local */
  }
  if (isMobileDataEnabled()) return buildLocalWebInbox();
  return { filmCount: 0, repairCount: 0, shopCount: 0, printCount: 0, scanCount: 0, total: 0, items: [] };
}

export function subscribeWebInboxRefresh(onRefresh) {
  const run = () => onRefresh();
  window.addEventListener(WEB_INBOX_CHANGED, run);
  window.addEventListener(FILM_LAB_DATA_CHANGED, run);
  window.addEventListener(REPAIR_DATA_CHANGED, run);
  const onStorage = (e) => {
    if (e.key === WEB_INBOX_PING_KEY) run();
  };
  window.addEventListener('storage', onStorage);
  const onVis = () => {
    if (document.visibilityState === 'visible') run();
  };
  document.addEventListener('visibilitychange', onVis);
  const timer = window.setInterval(run, 20000);
  return () => {
    window.removeEventListener(WEB_INBOX_CHANGED, run);
    window.removeEventListener(FILM_LAB_DATA_CHANGED, run);
    window.removeEventListener(REPAIR_DATA_CHANGED, run);
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVis);
    window.clearInterval(timer);
  };
}
