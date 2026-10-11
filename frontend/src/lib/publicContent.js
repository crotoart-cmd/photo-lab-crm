import publicApi from '../api/publicClient';

export async function loadPublicContent() {
  try {
    const { data } = await publicApi.get('/site-content/public');
    return {
      blog: Array.isArray(data?.blog) ? data.blog : [],
      accessories: Array.isArray(data?.accessories) ? data.accessories : [],
    };
  } catch {
    return { blog: [], accessories: [] };
  }
}

export function formatContentDate(value, locale = 'en') {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : locale, {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
