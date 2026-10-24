import { useCallback, useEffect, useState } from 'react';
import publicApi from '../api/publicClient';
import { remoteBlogPosts } from '../lib/publicBlog';
import { journalPost } from '../lib/publicJournal';
import { journalPreviewPosts } from '../data/journalPreview';
import { usePublicLocale } from '../components/public/PublicLocale';

function previewPosts(lang, draft) {
  return journalPreviewPosts(lang, { draft }).map(journalPost);
}

function cmsPosts(rows, t, lang) {
  return remoteBlogPosts(rows, t, lang).map((post, index) => journalPost({
    ...post,
    blocks: rows[index].blocks,
    tags: rows[index].tags,
    category: rows[index].category,
    language: rows[index].language,
    featured: rows[index].featured,
  }));
}

function mergeJournalPosts(preview, remote) {
  const bySlug = new Map(preview.map((post) => [post.slug, post]));
  remote.forEach((post) => bySlug.set(post.slug, post));
  return [...bySlug.values()];
}

export default function useJournalPosts() {
  const { t, lang } = usePublicLocale();
  const [state, setState] = useState({ posts: [], status: 'loading' });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true;
    setState({ posts: [], status: 'loading' });
    const read = async () => {
      if (import.meta.env.DEV && import.meta.env.VITE_JOURNAL_PREVIEW === 'true') {
        return previewPosts(lang, true);
      }
      const preview = previewPosts(lang, false);
      try {
        const { data } = await publicApi.get('/site-content/public');
        const rows = Array.isArray(data?.blog) ? data.blog.filter((row) => row.published !== false) : [];
        if (!rows.length) return preview;
        return mergeJournalPosts(preview, cmsPosts(rows, t, lang));
      } catch {
        return preview;
      }
    };
    read().then((posts) => { if (active) setState({ posts, status: 'ready' }); })
      .catch(() => { if (active) setState({ posts: previewPosts(lang, false), status: 'ready' }); });
    return () => { active = false; };
  }, [lang, revision, t]);
  return { ...state, reload };
}
