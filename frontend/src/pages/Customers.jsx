import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import FeedbackBanner from '../components/FeedbackBanner';
import SearchField, { SearchFieldRow } from '../components/SearchField';
import Customer360Modal from '../components/customers/Customer360Modal';
import CustomerMobileCard from '../components/customers/CustomerMobileCard';
import CustomerTagPill, { LtvBadge } from '../components/customers/CustomerTagPill';
import { IconDetail, IconEdit, IconDelete, IconContact, IconLocation } from '../components/icons/tabBarIcons';
import { ICON_SIZE } from '../components/icons/iconSizes';
import { IosPage } from '../components/mobile';
import { LabeledInput, LabeledTextarea } from '../components/formFields';
import {
  loadEnrichedCustomers,
  loadCareTasks,
  loadCustomerProfile,
  loadDuplicateGroups,
  mergeCustomers,
  filterByTag,
  searchCustomersLocal,
  saveCustomer,
} from '../lib/mobileCustomerBridge';
import { validateCustomerForm, fullName } from '../utils/customerNormalize';
import { CUSTOMER_NOTE_TEMPLATES, appendNoteTemplate } from '../utils/customerNoteTemplates';
import { exportCareListCsv } from '../utils/customerExport';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../utils/apiError';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  notes: '',
};

const TAG_FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'vip', label: 'VIP' },
  { id: 'new', label: 'Khách mới' },
  { id: 'inactive30', label: '30 ngày chưa quay lại' },
  { id: 'c41', label: 'Hay C41' },
  { id: 'pickup', label: 'Sẵn trả' },
  { id: 'unpaid', label: 'Còn nợ' },
];

export default function Customers() {
  const { showToast, showError } = useToast();
  const [customers, setCustomers] = useState([]);
  const [careTasks, setCareTasks] = useState({ inactive30d: [], readyPickup: [] });
  const [duplicates, setDuplicates] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [source, setSource] = useState('server');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const [listRes, care, dups] = await Promise.all([
      loadEnrichedCustomers(),
      loadCareTasks().catch(() => ({ inactive30d: [], readyPickup: [] })),
      loadDuplicateGroups().catch(() => []),
    ]);
    setCustomers(listRes.customers);
    setSource(listRes.source);
    setCareTasks(care);
    setDuplicates(dups);
  }, []);

  useEffect(() => {
    reload().catch(() => setError('Không tải được danh sách khách hàng'));
  }, [reload]);

  const visibleCustomers = useMemo(() => {
    let rows = customers;
    if (search.trim()) {
      rows = isMobileDataEnabled()
        ? searchCustomersLocal(search, customers)
        : rows.filter((c) => {
            const q = search.toLowerCase();
            return (
              fullName(c).toLowerCase().includes(q) ||
              (c.email || '').toLowerCase().includes(q) ||
              (c.phone || '').includes(search.replace(/\D/g, '')) ||
              (c.customerCode || '').toLowerCase().includes(q)
            );
          });
    }
    return filterByTag(rows, tagFilter);
  }, [customers, search, tagFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (customer) => {
    setForm({
      fullName: fullName(customer),
      email: customer.email,
      phone: customer.phone,
      address: customer.address || '',
      city: customer.city || '',
      postalCode: customer.postalCode || '',
      notes: customer.notes || '',
    });
    setEditingId(customer._id);
    setFormError('');
    setShowModal(true);
  };

  const openProfile = async (customer) => {
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      const data = await loadCustomerProfile(customer._id);
      setProfile(data);
    } catch {
      setProfile({ customer, timeline: [], stats: customer.stats, tags: customer.tags });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { errors, normalized } = validateCustomerForm(form);
    if (errors.length) {
      const msg = errors.join('. ');
      setFormError(msg);
      showError({ message: msg });
      return;
    }

    setSaving(true);
    try {
      const result = await saveCustomer({ editingId, normalized });

      if (result.possibleDuplicates?.length) {
        showToast({
          title: 'Đã lưu',
          message: `Phát hiện ${result.possibleDuplicates.length} khách có thể trùng`,
        });
      } else if (result.savedOnDevice) {
        showToast({
          title: 'Đã lưu trên máy',
          message: result.message || 'Mac sẽ backup khi kết nối được server',
        });
      } else {
        showToast({ title: 'Đã lưu', message: 'Cập nhật khách hàng thành công' });
      }

      setShowModal(false);
      setFormError('');
      setError('');
      await reload();
    } catch (err) {
      const msg = apiErrorMessage(err, 'Lưu thất bại');
      setFormError(msg);
      showError({ message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa khách hàng này?')) return;
    await api.delete(`/customers/${id}`);
    await reload();
  };

  const handleMergeGroup = async (group) => {
    if (group.customers.length < 2) return;
    const keep = group.customers[0];
    const remove = group.customers[1];
    if (!window.confirm(`Gộp "${fullName(remove)}" vào "${fullName(keep)}"?`)) return;

    setMergeBusy(true);
    try {
      await mergeCustomers(keep._id, remove._id);
      setInfo('Đã gộp khách trùng');
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Gộp khách thất bại');
    } finally {
      setMergeBusy(false);
    }
  };

  const careCount = (careTasks.inactive30d?.length || 0) + (careTasks.readyPickup?.length || 0);

  return (
    <IosPage>
      <div>
        <PageHeader title="Khách hàng">
          <button
            type="button"
            onClick={() => exportCareListCsv(careTasks)}
            className="apple-btn-secondary text-sm"
            disabled={careCount === 0}
          >
            Xuất CSV chăm sóc
          </button>
          <button type="button" onClick={openCreate} className="apple-btn-primary text-sm">
            + Thêm khách
          </button>
        </PageHeader>

        {source === 'cache' && (
          <p className="text-xs text-[var(--color-label-secondary)] mb-3">
            Đang dùng danh sách lưu trên máy — tìm kiếm offline hoạt động ngay.
          </p>
        )}

        {error && (
          <div className="mb-4">
            <FeedbackBanner variant="error">{error}</FeedbackBanner>
          </div>
        )}
        {info && (
          <div className="mb-4">
            <FeedbackBanner variant="warning">{info}</FeedbackBanner>
          </div>
        )}

        {duplicates.length > 0 && (
          <section className="apple-card p-4 mb-4 border border-amber-200 bg-amber-50/60">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-amber-900">
                Phát hiện {duplicates.length} nhóm khách trùng
              </h2>
            </div>
            <ul className="space-y-2">
              {duplicates.slice(0, 3).map((group) => (
                <li key={group.id} className="text-sm text-amber-950 flex flex-wrap items-center gap-2">
                  <span>
                    {group.customers.map((c) => fullName(c)).join(' · ')}
                    <span className="text-xs text-amber-800 ml-1">({group.reason.join(', ')})</span>
                  </span>
                  <button
                    type="button"
                    disabled={mergeBusy}
                    onClick={() => handleMergeGroup(group)}
                    className="apple-btn-secondary !py-1 text-xs"
                  >
                    Gộp 1 chạm
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {careCount > 0 && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <CareCard
              title="Gọi/Zalo sáng nay"
              subtitle="30 ngày chưa quay lại"
              count={careTasks.inactive30d?.length || 0}
              items={careTasks.inactive30d}
            />
            <CareCard
              title="Nhắc lấy film"
              subtitle="Sẵn trả chưa tới lấy"
              count={careTasks.readyPickup?.length || 0}
              items={careTasks.readyPickup}
            />
          </section>
        )}

        <div className="mb-4 space-y-3">
          <SearchFieldRow className="search-field-row--bleed">
            <SearchField
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm tên, SĐT, email, mã KH..."
              aria-label="Tìm khách hàng"
            />
          </SearchFieldRow>
          <div className="flex flex-wrap gap-2">
            {TAG_FILTERS.map((tag) => (
              <button
                key={tag.id || 'all'}
                type="button"
                onClick={() => setTagFilter(tag.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                  tagFilter === tag.id
                    ? 'bg-[var(--color-blue)] text-white border-[var(--color-blue)]'
                    : 'bg-white border-[var(--color-separator)] text-[var(--color-label-secondary)]'
                }`}
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {visibleCustomers.map((c) => (
            <CustomerMobileCard
              key={c._id}
              customer={c}
              onProfile={openProfile}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {showModal && (
          <Modal
            title={editingId ? 'Sửa khách hàng' : 'Thêm khách hàng'}
            onClose={() => {
              if (saving) return;
              setShowModal(false);
              setFormError('');
            }}
            compact
            footer={
              <button
                type="submit"
                form="customer-form"
                className="apple-btn-primary w-full"
                disabled={saving}
              >
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            }
          >
            <form id="customer-form" onSubmit={handleSubmit} className="customer-form-grid space-y-2.5">
              {formError ? <p className="text-sm text-[var(--color-red)]">{formError}</p> : null}
              <LabeledInput
                label="Họ và tên"
                required
                showCharCount={false}
                autoComplete="name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <div className="customer-form-row-2">
                <LabeledInput
                  label="Email"
                  required
                  type="email"
                  showCharCount={false}
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  leadingIconComponent={<IconContact framed={false} size={ICON_SIZE.field} />}
                />
                <LabeledInput
                  label="Số điện thoại"
                  required
                  type="tel"
                  showCharCount={false}
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  leadingIconComponent={<IconContact framed={false} size={ICON_SIZE.field} />}
                />
              </div>
              <LabeledInput
                label="Địa chỉ"
                showCharCount={false}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                leadingIconComponent={<IconLocation framed={false} size={ICON_SIZE.field} />}
              />
              <div className="customer-form-row-2">
                <LabeledInput
                  label="Thành phố"
                  showCharCount={false}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <LabeledInput
                  label="Mã bưu điện"
                  showCharCount={false}
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                />
              </div>
              <LabeledTextarea
                label="Ghi chú nội bộ"
                rows={2}
                textSize="normal"
                showCharCount={false}
                helperText="Chỉ hiển thị trên phần mềm — không gửi trong email cho khách"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <details className="rounded-lg border border-[var(--color-separator)] bg-[var(--color-bg-secondary)] px-3 py-2">
                <summary className="cursor-pointer text-[13px] font-medium text-[var(--color-label-secondary)]">
                  Mẫu ghi chú nhanh
                </summary>
                <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-label-tertiary)]">
                  Gợi ý nội bộ cho nhân viên — không đính kèm email khách.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 pb-1">
                  {CUSTOMER_NOTE_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      className="rounded-full border border-[var(--color-separator)] bg-white px-2 py-0.5 text-[12px]"
                      onClick={() => setForm((f) => ({ ...f, notes: appendNoteTemplate(f.notes, tpl) }))}
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </details>
            </form>
          </Modal>
        )}

        <Customer360Modal
          open={profileOpen}
          profile={profile}
          loading={profileLoading}
          onClose={() => {
            setProfileOpen(false);
            setProfile(null);
          }}
        />
      </div>
    </IosPage>
  );
}

function CareCard({ title, subtitle, count, items }) {
  return (
    <div className="apple-card p-4">
      <p className="text-sm font-semibold text-[var(--color-label)]">{title}</p>
      <p className="text-xs text-[var(--color-label-secondary)]">{subtitle}</p>
      <p className="text-2xl font-bold text-[var(--color-blue)] mt-2">{count}</p>
      <ul className="mt-3 space-y-1 text-sm max-h-28 overflow-y-auto">
        {(items || []).slice(0, 5).map((item) => (
          <li key={item.id} className="flex justify-between gap-2">
            <span className="truncate">{item.name}</span>
            <span className="text-[var(--color-label-tertiary)] shrink-0">{item.phone}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
