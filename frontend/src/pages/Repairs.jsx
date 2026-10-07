import { useCallback, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import FeedbackBanner from '../components/FeedbackBanner';
import SearchField from '../components/SearchField';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import CustomerSearchPicker from '../components/CustomerSearchPicker';
import RepairTicketDetail from '../components/repair/RepairTicketDetail';
import AppleSegmentedControl from '../components/AppleSegmentedControl';
import LabPageShell from '../components/lab/LabPageShell';
import LabMasterDetail, { LabDetailEmpty } from '../components/lab/LabMasterDetail';
import { apiErrorMessage } from '../utils/apiError';
import {
  REPAIR_TABS,
  REPAIR_STATUS_LABELS,
  REPAIR_STATUS_PILL,
  sortRepairTickets,
} from '../constants/customerRepair';
import { LabeledInput, LabeledTextarea } from '../components/formFields';
import {
  loadRepairsBridge,
  createRepairBridge,
  REPAIR_DATA_CHANGED,
} from '../lib/mobileRepairBridge';

const EMPTY_FORM = {
  customerId: '',
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  model_name: '',
  brand: '',
  serial_number: '',
  symptom: '',
  condition_at_intake: '',
  intake_note: '',
};

export default function Repairs() {
  const [statusFilter, setStatusFilter] = useState('');
  const [tickets, setTickets] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  const selected = tickets.find((t) => t._id === selectedId) || null;

  const loadTickets = useCallback(async () => {
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (searchQ.trim()) params.q = searchQ.trim();
    const { tickets } = await loadRepairsBridge(params);
    setTickets(sortRepairTickets(tickets));
    return tickets;
  }, [statusFilter, searchQ]);

  useEffect(() => {
    loadTickets().catch(() => setError('Không tải được danh sách phiếu sửa'));
  }, [loadTickets]);

  useEffect(() => {
    const onChanged = () => {
      loadTickets().catch(() => {});
    };
    window.addEventListener(REPAIR_DATA_CHANGED, onChanged);
    return () => window.removeEventListener(REPAIR_DATA_CHANGED, onChanged);
  }, [loadTickets]);

  const handleCreate = async () => {
    setSaving(true);
    setError('');
    try {
      const data = await createRepairBridge(form);
      if (data.emailError) {
        setError(`Phiếu đã tạo nhưng gửi email thất bại: ${data.emailError}`);
      }
      setSuccess(data.message || 'Đã tạo phiếu');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setSelectedCustomer(null);
      await loadTickets();
      if (data.ticket?._id) setSelectedId(data.ticket._id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Tạo phiếu thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const onCustomerPick = (c) => {
    setSelectedCustomer(c);
    setForm((f) => ({
      ...f,
      customerId: c._id,
      customer_name: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      customer_email: c.email || '',
      customer_phone: c.phone || '',
    }));
  };

  const listPanel = (
    <div className="lab-list-panel">
      <div className="lab-list-panel__header">
        <span>Danh sách phiếu</span>
        <span>{tickets.length} phiếu</span>
      </div>
      <ul className="lab-list-panel__body divide-y divide-[var(--color-separator)]">
        {tickets.length === 0 && (
          <li className="p-6 text-center text-sm text-[var(--color-label-secondary)]">
            Chưa có phiếu — bấm Tiếp nhận máy
          </li>
        )}
        {tickets.map((t) => (
          <li key={t._id}>
            <button
              type="button"
              onClick={() => setSelectedId(t._id)}
              className={`lab-list-row w-full ${selectedId === t._id ? 'lab-list-row--selected' : ''}`}
            >
              <div className="lab-list-row__main">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-[var(--color-label-tertiary)]">
                    {t.ticket_number}
                  </span>
                  <StatusPill variant={REPAIR_STATUS_PILL[t.status] || 'active'}>
                    {REPAIR_STATUS_LABELS[t.status]}
                  </StatusPill>
                </div>
                <p className="font-semibold text-[var(--color-label)] mt-1">{t.model_name}</p>
                <p className="text-sm text-[var(--color-label-secondary)] truncate">{t.customer_name}</p>
                <p className="text-xs text-[var(--color-label-tertiary)] mt-1 line-clamp-2">{t.symptom}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <LabPageShell>
      <PageHeader title="Sửa máy khách">
        <button
          type="button"
          className="apple-btn-primary w-full sm:w-auto"
          onClick={() => setShowCreate(true)}
        >
          Tiếp nhận máy
        </button>
      </PageHeader>

      {error && (
        <div className="mb-4">
          <FeedbackBanner variant="error">{error}</FeedbackBanner>
        </div>
      )}
      {success && (
        <div className="mb-4">
          <FeedbackBanner variant="success" onDismiss={() => setSuccess('')}>
            {success}
          </FeedbackBanner>
        </div>
      )}

      <AppleSegmentedControl
        className="mb-4"
        items={REPAIR_TABS}
        value={statusFilter}
        onChange={(id) => {
          setStatusFilter(id);
          setSelectedId(null);
        }}
      />

      <div className="mb-4">
        <SearchField
          placeholder="Tìm mã phiếu, khách, model, sê-ri…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>

      <LabMasterDetail
        listHidden={Boolean(selectedId)}
        detailHidden={!selectedId}
        onBack={() => setSelectedId(null)}
        backLabel="← Danh sách phiếu"
        list={listPanel}
        detail={
          selected ? (
            <RepairTicketDetail
              ticket={selected}
              onUpdated={(ticket) => {
                setTickets((prev) =>
                  sortRepairTickets(prev.map((t) => (t._id === ticket._id ? ticket : t)))
                );
              }}
              onError={setError}
              onSuccess={setSuccess}
            />
          ) : (
            <LabDetailEmpty>Chọn phiếu để xem chi tiết</LabDetailEmpty>
          )
        }
      />

      {showCreate && (
        <Modal title="Tiếp nhận máy khách" onClose={() => setShowCreate(false)}>
          <div className="space-y-3">
            <CustomerSearchPicker
              customerId={form.customerId}
              selectedCustomer={selectedCustomer}
              onSelect={onCustomerPick}
              onClear={() => {
                setSelectedCustomer(null);
                setForm((f) => ({
                  ...f,
                  customerId: '',
                  customer_name: '',
                  customer_email: '',
                  customer_phone: '',
                }));
              }}
            />
            <LabeledInput
              label="Họ tên khách *"
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
            />
            <LabeledInput
              label="Email *"
              type="email"
              value={form.customer_email}
              onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
            />
            <LabeledInput
              label="SĐT"
              value={form.customer_phone}
              onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
            />
            <LabeledInput
              label="Model máy *"
              value={form.model_name}
              onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput
                label="Hãng"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
              <LabeledInput
                label="Sê-ri"
                value={form.serial_number}
                onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
              />
            </div>
            <LabeledTextarea
              label="Triệu chứng / mô tả lỗi *"
              rows={3}
              value={form.symptom}
              onChange={(e) => setForm((f) => ({ ...f, symptom: e.target.value }))}
            />
            <LabeledTextarea
              label="Tình trạng lúc nhận"
              rows={2}
              value={form.condition_at_intake}
              onChange={(e) => setForm((f) => ({ ...f, condition_at_intake: e.target.value }))}
            />
            <LabeledTextarea
              label="Ghi chú nội bộ"
              rows={2}
              value={form.intake_note}
              onChange={(e) => setForm((f) => ({ ...f, intake_note: e.target.value }))}
            />
            <p className="text-xs text-[var(--color-label-tertiary)]">
              Sau khi tạo, hệ thống gửi email phiếu tiếp nhận cho khách (nếu SMTP đã cấu hình).
            </p>
            <button
              type="button"
              className="apple-btn-primary w-full"
              disabled={saving}
              onClick={handleCreate}
            >
              {saving ? 'Đang lưu…' : 'Tạo phiếu & gửi email'}
            </button>
          </div>
        </Modal>
      )}
    </LabPageShell>
  );
}
