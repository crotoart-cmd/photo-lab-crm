import { LAB_PHOTO } from '../data/publicLabPhotos';
import { formatContentDate } from './publicContent';

export const FALLBACK_POSTS = [
  { id: 'p1', slug: 'fresh-chemistry', tone: 'film' },
  { id: 'p2', slug: 'noritsu-frontier-heidelberg', tone: 'scan' },
  { id: 'p3', slug: 'after-the-scans', tone: 'speed' },
];

export function slugify(text) {
  const s = String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'post';
}

export function formatPostDate(value, locale = 'en') {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function parsePostBody(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  return raw.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim();
    if (trimmed.startsWith('## ')) {
      const [heading, ...rest] = trimmed.slice(3).split('\n');
      return { type: 'h', heading: heading.trim(), text: rest.join('\n').trim() };
    }
    return { type: 'p', text: trimmed };
  });
}

function hrefFor(slug) {
  return `/blog/${slug}`;
}

export function fallbackBlogPosts(t) {
  return FALLBACK_POSTS.map((post, i) => ({
    id: post.id,
    slug: post.slug,
    href: hrefFor(post.slug),
    title: t(`blog.${post.id}h`),
    kind: t(`blog.${post.id}k`),
    excerpt: t(`blog.${post.id}p`),
    date: t(`blog.${post.id}d`),
    dateLong: t(`blog.${post.id}d`),
    author: t('blog.author'),
    image: LAB_PHOTO.blog[i] || '',
    tone: post.tone,
    body: [t(`blog.${post.id}p`), t(`blog.${post.id}b`)].filter(Boolean).join('\n\n'),
  }));
}

export function remoteBlogPosts(rows, t, lang) {
  return (rows || []).map((row, i) => {
    const slug = row.slug || slugify(row.title) || String(row.id);
    return {
      id: row.id,
      slug,
      href: hrefFor(slug),
      title: row.title,
      kind: row.kind || t('home.storyKind'),
      excerpt: row.excerpt || row.body,
      date: formatContentDate(row.date, lang),
      dateLong: formatPostDate(row.date, lang),
      author: row.author || t('blog.author'),
      image: row.image || LAB_PHOTO.blog[i % LAB_PHOTO.blog.length] || '',
      tone: FALLBACK_POSTS[i % FALLBACK_POSTS.length].tone,
      body: row.body || row.excerpt || '',
    };
  });
}

export function findBlogPost(posts, slug) {
  const key = String(slug || '');
  return posts.find((p) => p.slug === key || p.id === key) || null;
}
