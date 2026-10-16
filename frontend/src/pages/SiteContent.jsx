import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { apiErrorMessage } from '../utils/apiError';
import PageHeader from '../components/PageHeader';
import LabPageShell from '../components/lab/LabPageShell';
import { LabeledInput, LabeledTextarea } from '../components/formFields';
import FeedbackBanner from '../components/FeedbackBanner';
import Modal from '../components/Modal';

const emptyForm = {
  title: '',
  slug: '',
  kind: '',
  author: '',
  excerpt: '',
  body: '',
  published: true,
  sort: 0,
};

export default function SiteContent({ lockType, embedded = false }) {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState(() => lockType || 'blog');
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/site-content').then(({ data }) => setItems(Array.isArray(data) ? data : []));

  useEffect(() => {
    load().catch((err) => setBanner({ type: 'error', text: apiErrorMessage(err) }));
  }, []);

  useEffect(() => {
    if (lockType) {
      setType(lockType);
      return;
    }
    setType('blog');
  }, [lockType]);

  const list = items.filter((i) => i.type === type);

  const openCreate = () => {
    setForm(emptyForm);
    setFile(null);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    setForm({
      title: row.title || '',
      slug: row.slug || '',
      kind: row.kind || '',
      author: row.author || '',
      excerpt: row.excerpt || '',
      body: row.body || '',
      published: row.published !== false,
      sort: row.sort || 0,
    });
    setFile(null);
    setEditingId(row.id);
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const data = new FormData();
      data.append('type', type);
      data.append('title', form.title);
      data.append('slug', form.slug);
      data.append('kind', form.kind);
      data.append('author', form.author);
      data.append('excerpt', form.excerpt);
      data.append('body', form.body);
      data.append('published', form.published ? 'true' : 'false');
      data.append('sort', String(form.sort || 0));
      if (file) data.append('image', file);
      if (editingId) await api.patch(`/site-content/${editingId}`, data);
      else await api.post('/site-content', data);
      setOpen(false);
      await load();
      setBanner({
        type: 'ok',
        text:
          type === 'accessory'
            ? 'Đã lưu. Bật đăng thì hiện trên /shop.'
            : 'Đã lưu. Bật đăng thì hiện trên /blog.',
      });
    } catch (err) {
      setBanner({ type: 'error', text: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Xóa “${row.title}”?`)) return;
    try {
      await api.delete(`/site-content/${row.id}`);
      await load();
    } catch (err) {
      setBanner({ type: 'error', text: apiErrorMessage(err) });
    }
  };

  if (!lockType && searchParams.get('type') === 'accessory') {
    return <Navigate to="/retail?tab=intake#merch" replace />;
  }

  const editor = (
    <>
      {!embedded ? (
        <PageHeader className="lab-page-head" title="Blog" subtitle="Bài viết trên /blog. Hàng bán web đăng trong Shop Products → Kho.">
          <button type="button" className="apple-btn-primary btn-pill" onClick={openCreate}>
            Thêm bài
          </button>
        </PageHeader>
      ) : (
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[13px] text-[var(--color-label-secondary)] leading-snug">
            Ảnh và mô tả trên trang Shop Products của website. Tồn kho bán kiểm ở tab Kho.
          </p>
          <button type="button" className="apple-btn-primary btn-pill shrink-0" onClick={openCreate}>
            Thêm
          </button>
        </div>
      )}

      {banner ? (
        <FeedbackBanner
          variant={banner.type === 'error' ? 'error' : 'success'}
          onDismiss={() => setBanner(null)}
        >
          {banner.text}
        </FeedbackBanner>
      ) : null}

      {!embedded ? (
        <p className="mt-1 mb-3 text-[13px] text-[var(--color-label-secondary)] leading-snug">
          Không liên quan phiếu film hay kho Shop Products.
        </p>
      ) : null}

      <div className={embedded ? undefined : 'lab-desk'}>
      <ul className={embedded ? 'mt-4 divide-y divide-[var(--color-separator,rgba(60,60,67,0.12))]' : 'lab-blog-list'}>
        {list.length === 0 ? (
          <li className="lab-table-empty">
            {type === 'accessory'
              ? 'Chưa có mục trưng bày. Bấm Thêm để gắn ảnh phụ kiện lên website.'
              : 'Chưa có bài. Bấm Thêm bài để viết.'}
          </li>
        ) : (
          list.map((row) => (
            <li key={row.id} className="flex gap-3 py-3 items-center">
              {row.image ? (
                <img src={row.image} alt="" className="w-14 h-14 object-cover shrink-0 bg-[var(--color-fill)]" />
              ) : (
                <div className="w-14 h-14 shrink-0 bg-[var(--color-fill,rgba(120,120,128,0.12))]" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium truncate">{row.title}</p>
                <p className="text-[13px] text-[var(--color-label-secondary)] truncate">
                  {row.kind || (type === 'blog' ? 'Blog' : 'Phụ kiện web')}
                  {row.published === false ? ' · nháp' : ''}
                </p>
              </div>
              <button type="button" className="apple-btn-secondary btn-pill text-[13px]" onClick={() => openEdit(row)}>
                Sửa
              </button>
              <button type="button" className="apple-btn-secondary btn-pill text-[13px]" onClick={() => handleDelete(row)}>
                Xóa
              </button>
            </li>
          ))
        )}
      </ul>
      </div>

      {open ? (
      <Modal onClose={() => setOpen(false)} title={editingId ? 'Sửa mục' : 'Thêm mục'}>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <LabeledInput
            label="Tiêu đề"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          {type === 'blog' ? (
            <LabeledInput
              label="Đường dẫn (để trống thì lấy từ tiêu đề)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="fresh-chemistry"
            />
          ) : null}
          <LabeledInput
            label={type === 'blog' ? 'Nhóm (Chemistry, Scanners…)' : 'Nhóm trưng bày (Hộp phim, Túi…)'}
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
          />
          {type === 'blog' ? (
            <LabeledInput
              label="Người viết"
              value={form.author}
              onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
              placeholder="HDTLabx"
            />
          ) : null}
          <LabeledTextarea
            label="Đoạn dẫn"
            value={form.excerpt}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            rows={3}
          />
          <LabeledTextarea
            label={
              type === 'blog'
                ? 'Nội dung (đoạn cách dòng trống; tiêu đề phụ bắt đầu ## )'
                : 'Nội dung'
            }
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={8}
          />
          <label className="block text-[13px] text-[var(--color-label-secondary)]">
            Ảnh vuông (JPG / PNG)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="mt-1 block w-full text-[15px]"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label className="flex items-center gap-2 text-[15px]">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
            />
            Đăng lên trang lab
          </label>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" className="apple-btn-secondary btn-pill" onClick={() => setOpen(false)}>
              Hủy
            </button>
            <button type="submit" className="apple-btn-primary btn-pill" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </form>
      </Modal>
      ) : null}
    </>
  );

  if (embedded) return editor;
  return <LabPageShell wide>{editor}</LabPageShell>;
}
