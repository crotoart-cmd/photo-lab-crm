import { parsePostBody } from './publicBlog';

export const JOURNAL_CATEGORIES = ['photography', 'stories', 'repair'];
export const JOURNAL_PAGE_SIZE = 6;

const EN = {
  title: 'Journal', intro: 'On photography, the images we make, and the cameras we keep.',
  all: 'All stories', photography: 'Photography', stories: 'Photo stories', repair: 'Repair',
  search: 'Search the journal', clear: 'Clear search', latest: 'Latest stories', featured: 'Editor\'s selection',
  read: 'Read story', minutes: 'min read', results: 'stories', result: 'story', draft: 'Editorial draft',
  bench: 'On the Bench', benchIntro: 'A closer look at the things that keep a camera working.',
  benchLink: 'From the workshop', roll: 'One Roll / One Story', rollIntro: 'A little less rushing. A little more looking.',
  more: 'More stories', previous: 'Previous page', next: 'Next page', page: 'Page', of: 'of',
  noResults: 'No stories found.', noResultsText: 'Try another word or explore a different category.', reset: 'Show all stories',
  empty: 'The next story is taking shape.', emptyText: 'New notes from the lab will appear here.',
  loading: 'Loading stories...', error: 'The journal could not be loaded.', retry: 'Try again',
  back: 'Back to journal', contents: 'In this story', author: 'Words', published: 'Published', draftDate: 'Draft date',
  share: 'Share story', copied: 'Link copied', copyError: 'Copy this link', openImage: 'View photograph',
  close: 'Close viewer', nextImage: 'Next photograph', previousImage: 'Previous photograph',
  original: 'Original language', reading: 'Reading progress', related: 'Read next',
  repairTitle: 'More life in your camera.', repairText: 'Tell us what you have noticed. The lab inspects the camera before recommending work.',
  repairCta: 'Talk to the workshop', filmTitle: 'Keep the story going.', filmText: 'From your next roll to the final scan.', filmCta: 'Film & scan',
  missing: 'This story is not here.', missingText: 'It may have moved, or it is not published yet.',
};
const VI = {
  title: 'Journal', intro: 'Về nhiếp ảnh, những khung hình và những chiếc máy ta muốn giữ lại.',
  all: 'Tất cả', photography: 'Nhiếp ảnh', stories: 'Chuyện ảnh', repair: 'Sửa máy',
  search: 'Tìm bài viết', clear: 'Xóa tìm kiếm', latest: 'Bài mới', featured: 'Bài chọn lọc',
  read: 'Đọc bài', minutes: 'phút đọc', results: 'bài viết', result: 'bài viết', draft: 'Bản nháp biên tập',
  bench: 'On the Bench', benchIntro: 'Nhìn kỹ hơn vào những điều giúp một chiếc máy tiếp tục hoạt động.',
  benchLink: 'Từ bàn sửa máy', roll: 'Một cuộn film / Một câu chuyện', rollIntro: 'Chậm lại một chút. Nhìn kỹ hơn một chút.',
  more: 'Bài viết khác', previous: 'Trang trước', next: 'Trang sau', page: 'Trang', of: '/',
  noResults: 'Chưa tìm thấy bài phù hợp.', noResultsText: 'Thử một từ khác hoặc một chuyên mục khác.', reset: 'Xem tất cả bài',
  empty: 'Câu chuyện tiếp theo đang thành hình.', emptyText: 'Những ghi chép mới từ lab sẽ xuất hiện tại đây.',
  loading: 'Đang tải bài viết...', error: 'Chưa tải được Journal.', retry: 'Thử lại',
  back: 'Về Journal', contents: 'Trong bài này', author: 'Biên soạn', published: 'Ngày đăng', draftDate: 'Ngày bản nháp',
  share: 'Chia sẻ bài viết', copied: 'Đã sao chép liên kết', copyError: 'Sao chép liên kết này', openImage: 'Xem ảnh',
  close: 'Đóng ảnh', nextImage: 'Ảnh tiếp theo', previousImage: 'Ảnh trước',
  original: 'Ngôn ngữ bài gốc', reading: 'Tiến độ đọc', related: 'Đọc tiếp',
  repairTitle: 'Để chiếc máy còn đi cùng bạn.', repairText: 'Kể cho lab những biểu hiện bạn nhận thấy. Máy sẽ được kiểm tra trước khi đề xuất sửa chữa.',
  repairCta: 'Tới xưởng sửa', filmTitle: 'Viết tiếp câu chuyện.', filmText: 'Từ cuộn film tiếp theo đến bản scan cuối cùng.', filmCta: 'Film & scan',
  missing: 'Chưa tìm thấy bài viết.', missingText: 'Bài có thể đã chuyển địa chỉ hoặc chưa được xuất bản.',
};
export function journalCopy(lang) { return lang === 'vi' ? VI : EN; }
export function searchText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}
export function categoryFor(post) {
  if (JOURNAL_CATEGORIES.includes(post.category)) return post.category;
  const kind = searchText(post.kind);
  if (/repair|sua|bench|bao duong/.test(kind)) return 'repair';
  if (/stor|chuyen|essay|project|nhat ky/.test(kind)) return 'stories';
  return 'photography';
}
export function journalPost(post) {
  const blocks = Array.isArray(post.blocks) ? post.blocks : parsePostBody(post.body).flatMap((block) => block.type === 'h'
    ? [{ type: 'heading', text: block.heading }, ...(block.text ? [{ type: 'paragraph', text: block.text }] : [])]
    : [{ type: 'paragraph', text: block.text }]);
  const text = [post.title, post.excerpt, ...blocks.map((block) => block.text || block.caption || '')].join(' ');
  return { ...post, category: categoryFor(post), blocks, tags: Array.isArray(post.tags) ? post.tags : [],
    minutes: Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 190)), language: ['en', 'vi', 'de', 'es'].includes(post.language) ? post.language : null };
}
export function selectJournalPosts(posts, { category = 'all', query = '' } = {}) {
  const terms = searchText(query).trim().split(/\s+/).filter(Boolean);
  return posts.filter((post) => (category === 'all' || post.category === category) && terms.every((term) =>
    searchText([post.title, post.excerpt, post.kind, post.category, ...(post.tags || []),
      ...(post.blocks || []).map((block) => block.text || '')].join(' ')).includes(term)));
}
export function journalPage(posts, rawPage, pageSize = JOURNAL_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(posts.length / pageSize));
  const parsed = Number(rawPage);
  const page = Number.isSafeInteger(parsed) ? Math.max(1, Math.min(pages, parsed)) : 1;
  return { page, pages, items: posts.slice((page - 1) * pageSize, page * pageSize) };
}
export function relatedJournalPosts(posts, post) {
  return posts.filter((item) => item.slug !== post.slug).map((item, order) => ({ item, order,
    score: (item.category === post.category ? 3 : 0) + item.tags.filter((tag) => post.tags.includes(tag)).length }))
    .sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 3).map(({ item }) => item);
}
export function journalHref(post, lang) { return `/blog/${encodeURIComponent(post.slug)}?lang=${lang}`; }
