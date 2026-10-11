import { useState } from 'react';
import { LabeledTextarea } from '../formFields';

export const MAX_SHOP_PHOTOS = 9;

export function galleryOf(card) {
  const list = [];
  for (const src of [card?.image, ...(card?.images || [])]) {
    if (src && !list.includes(src) && list.length < MAX_SHOP_PHOTOS) list.push(src);
  }
  return list;
}

export function useShopListingDraft(card) {
  const [showOnWeb, setShowOnWeb] = useState(Boolean(card?.showOnWeb));
  const [description, setDescription] = useState(card?.description || '');
  const [kept, setKept] = useState(() => galleryOf(card));
  const [pending, setPending] = useState([]);

  const slots = [
    ...kept.map((src) => ({ kind: 'kept', src })),
    ...pending.map((item) => ({ kind: 'file', src: item.preview, file: item.file })),
  ].slice(0, MAX_SHOP_PHOTOS);

  const reset = (next) => {
    pending.forEach((item) => URL.revokeObjectURL(item.preview));
    setShowOnWeb(Boolean(next?.showOnWeb));
    setDescription(next?.description || '');
    setKept(galleryOf(next));
    setPending([]);
  };

  const addFiles = (list) => {
    const room = MAX_SHOP_PHOTOS - kept.length - pending.length;
    const next = [...list].slice(0, room).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    if (next.length) setPending((cur) => [...cur, ...next]);
  };

  const removeAt = (index) => {
    const slot = slots[index];
    if (!slot) return;
    if (slot.kind === 'kept') {
      setKept((cur) => cur.filter((src) => src !== slot.src));
      return;
    }
    URL.revokeObjectURL(slot.src);
    setPending((cur) => cur.filter((item) => item.preview !== slot.src));
  };

  return {
    showOnWeb,
    setShowOnWeb,
    description,
    setDescription,
    kept,
    pending,
    slots,
    canAdd: slots.length < MAX_SHOP_PHOTOS,
    addFiles,
    removeAt,
    reset,
    payload: () => ({
      showOnWeb,
      description,
      imagesKept: kept,
      files: pending.map((item) => item.file),
    }),
    dirty: showOnWeb || Boolean(description.trim()) || kept.length > 0 || pending.length > 0,
  };
}

export default function ShopListingFields({ draft, hint }) {
  return (
    <div className="shop-listing-fields">
      <div className="shop-listing-photos">
        {draft.slots.map((slot, i) => (
          <div key={`${slot.kind}-${slot.src}`} className="shop-listing-slot">
            <img src={slot.src} alt="" />
            <button type="button" className="shop-listing-slot-x" onClick={() => draft.removeAt(i)} aria-label="Xóa ảnh">
              ×
            </button>
            {i === 0 ? <span className="shop-listing-cover">Ảnh chính</span> : null}
          </div>
        ))}
        {draft.canAdd ? (
          <label className="shop-listing-slot is-add">
            <span>Thêm ảnh</span>
            <small>
              {draft.slots.length}/{MAX_SHOP_PHOTOS}
            </small>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                draft.addFiles(e.target.files || []);
                e.target.value = '';
              }}
            />
          </label>
        ) : null}
      </div>

      <label className="shop-listing-row">
        <span>
          <strong>Hiện trên Shop</strong>
          <small>{hint || 'Khách thấy trên /phu-kien. Đơn vào tab Đơn.'}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="shop-switch"
          checked={draft.showOnWeb}
          onChange={(e) => draft.setShowOnWeb(e.target.checked)}
        />
      </label>

      <LabeledTextarea
        label="Mô tả trên web"
        rows={3}
        value={draft.description}
        maxLength={1200}
        onChange={(e) => draft.setDescription(e.target.value)}
        placeholder="Tình trạng, phụ kiện kèm theo…"
      />
    </div>
  );
}
