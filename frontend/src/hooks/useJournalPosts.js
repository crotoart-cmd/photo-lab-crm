import { useCallback, useEffect, useState } from 'react';
import publicApi from '../api/publicClient';
import { remoteBlogPosts } from '../lib/publicBlog';
import { journalPost } from '../lib/publicJournal';
import { usePublicLocale } from '../components/public/PublicLocale';

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
        const { journalPreviewPosts } = await import('../data/journalPreview');
        return journalPreviewPosts(lang).map(journalPost);
      }
      const { data } = await publicApi.get('/site-content/public');
      const rows = Array.isArray(data?.blog) ? data.blog.filter((row) => row.published !== false) : [];
      return remoteBlogPosts(rows, t, lang).map((post, index) => journalPost({ ...post,
        blocks: rows[index].blocks, tags: rows[index].tags, category: rows[index].category,
        language: rows[index].language, featured: rows[index].featured }));
    };
    read().then((posts) => { if (active) setState({ posts, status: 'ready' }); })
      .catch(() => { if (active) setState({ posts: [], status: 'error' }); });
    return () => { active = false; };
  }, [lang, revision]);
  return { ...state, reload };
}
