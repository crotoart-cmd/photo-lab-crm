import { useState } from 'react';
import api from '../../api/client';
import { confirmIntake } from '../../lib/mobileRetailBridge';
import { apiErrorMessage } from '../../utils/apiError';
import Modal from '../Modal';
import { LabeledInput } from '../formFields';
import ShopListingFields, { useShopListingDraft } from './ShopListingFields';

const EMPTY = {
  title: '',
  kind: '',
  sku: '',
  batteryType: '',
  cost: '',
  price: '',
  quantity: '1',
};

export default function MerchCreateSheet({ type = 'merch', web, onClose, onSaved, onError, onSuccess }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const listing = useShopListingDraft(null);
  const isBattery = type === 'battery';
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const digits = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.replace(/\D/g, '') }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isBattery) {
        const { data } = await confirmIntake({
          product_group: 'battery',
          name: form.title.trim(),
          sku_code: form.sku.trim().toUpperCase(),
          barcode: form.sku.trim().toUpperCase(),
          brand: form.kind.trim(),
          brand_group: form.kind.trim(),
          battery_type: form.batteryType.trim() || 'OTHER',
          note: listing.description.trim(),
          cost: Number(form.cost) || 0,
          price: Number(form.price) || 0,
          floor_price: Number(form.cost) || 0,
          quantity: Number(form.quantity) || 1,
        });
        const row = data?.row;
        if (row?._id && listing.dirty) {
          await web.save({ source: 'battery', id: row._id }, listing.payload());
        }
        onSuccess?.(listing.showOnWeb ? 'Đã nhập pin và đăng Shop' : data.message || 'Đã nhập pin');
      } else {
        const data = new FormData();
        data.append('type', 'accessory');
        data.append('title', form.title);
        data.append('kind', form.kind);
        data.append('excerpt', listing.description.trim());
        data.append('price', String(form.price || 0));
        data.append('quantity', String(form.quantity || 0));
        data.append('receivedQty', String(form.quantity || 0));
        data.append('published', listing.showOnWeb ? 'true' : 'false');
        const created = await api.post('/site-content', data);
        if (created.data?.id && listing.dirty) {
          await web.save({ source: 'merch', id: created.data.id }, listing.payload());
        }
        onSuccess?.(listing.showOnWeb ? 'Đã thêm merch và đăng Shop' : 'Đã thêm merch');
      }
      await web.reload();
      await onSaved?.();
      onClose();
    } catch (err) {
      onError?.(apiErrorMessage(err, isBattery ? 'Không nhập được pin' : 'Không lưu được merch'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isBattery ? 'Thêm pin' : 'Thêm merch'} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <ShopListingFields
          draft={listing}
          hint={isBattery ? 'Pin lên kệ Shop khi bật.' : 'Merch lên kệ Shop khi bật.'}
        />
        <LabeledInput
          label={isBattery ? 'Tên pin' : 'Tên'}
          value={form.title}
          onChange={set('title')}
          required
        />
        <LabeledInput
          label={isBattery ? 'Hãng' : 'Nhóm'}
          value={form.kind}
          onChange={set('kind')}
          placeholder={isBattery ? 'Energizer, Panasonic…' : 'Túi, áo, hộp phim…'}
        />
        {isBattery ? (
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Mã SKU" value={form.sku} onChange={set('sku')} placeholder="BAT-LR44" required />
            <LabeledInput
              label="Loại pin"
              value={form.batteryType}
              onChange={set('batteryType')}
              placeholder="LR44, CR123A…"
              required
            />
          </div>
        ) : null}
        {isBattery ? (
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Giá nhập" inputMode="numeric" value={form.cost} onChange={digits('cost')} />
            <LabeledInput label="Giá bán" inputMode="numeric" value={form.price} onChange={digits('price')} />
          </div>
        ) : (
          <LabeledInput label="Giá (VNĐ)" inputMode="numeric" value={form.price} onChange={digits('price')} />
        )}
        <LabeledInput label="Số lượng" inputMode="numeric" value={form.quantity} onChange={digits('quantity')} />
        <div className="flex gap-2 justify-end pt-2">
          <button type="button" className="apple-btn-secondary btn-pill" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="apple-btn-primary btn-pill" disabled={saving}>
            {saving ? 'Đang lưu…' : listing.showOnWeb ? 'Lưu và đăng Shop' : 'Lưu vào kho'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
