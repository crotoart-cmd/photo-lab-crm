import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import FeedbackBanner from '../components/FeedbackBanner';
import SearchField from '../components/SearchField';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import CustomerSearchPicker from '../components/CustomerSearchPicker';
import RepairTicketDetail from '../components/repair/RepairTicketDetail';
import LabPageShell from '../components/lab/LabPageShell';
import LabMasterDetail, { LabRowMark } from '../components/lab/LabMasterDetail';
import LabStatusRail, { LabPager } from '../components/lab/LabStatusRail';
import { apiErrorMessage } from '../utils/apiError';
import { LAB_PAGE_SIZE, formatLabRelative, ticketMark } from '../utils/labFormat';
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
  const [searchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [tickets, setTickets] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedId, setSelectedId] = useState(() => searchParams.get('id') || null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const railItems = useMemo(() => {
    const counts = {};
    tickets.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return REPAIR_TABS.map((tab) => ({
      ...tab,
      count: tab.id === '' ? tickets.length : counts[tab.id] || 0,
    }));
  }, [tickets]);

  const visible = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [t.ticket_number, t.model_name, t.brand, t.serial_number, t.customer_name, t.symptom]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tickets, statusFilter, searchQ]);

  const pageCount = Math.max(1, Math.ceil(visible.length / LAB_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * LAB_PAGE_SIZE, safePage * LAB_PAGE_SIZE);
  const rangeFrom = visible.length ? (safePage - 1) * LAB_PAGE_SIZE + 1 : 0;
  const rangeTo = Math.min(safePage * LAB_PAGE_SIZE, visible.length);
  const selected = visible.find((t) => t._id === selectedId) || null;

  useEffect(() => {
    setPage(1);
  }, [statusFilter, searchQ]);

  const loadTickets = useCallback(async () => {
    const { tickets: rows } = await loadRepairsBridge({});
    setTickets(sortRepairTickets(rows));
    return rows;
  }, []);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status != null && REPAIR_TABS.some((t) => t.id === status)) {
      setStatusFilter(status);
    }
    const id = searchParams.get('id');
    if (id) setSelectedId(id);
  }, [searchParams]);

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
      if (data.ticket?._id) {
        setStatusFilter('');
        setSelectedId(data.ticket._id);
      }
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
    <div className="lab-table">
      <div className="lab-table-head">
        <span>Máy</span>
        <span>Khách</span>
        <span className="lab-col-extra">Triệu chứng</span>
        <span>Trạng thái</span>
        <span className="lab-col-extra">Cập nhật</span>
      </div>
      {visible.length === 0 && (
        <div className="lab-table-empty">
          {tickets.length === 0 ? 'Chưa có phiếu — bấm Tiếp nhận máy' : 'Không khớp bộ lọc'}
        </div>
      )}
      {pageRows.map((t) => {
        const active = selectedId === t._id;
        return (
          <div
            key={t._id}
            role="option"
            tabIndex={0}
            aria-selected={active}
            className={`lab-table-row${active ? ' is-selected' : ''}`}
            onClick={() => setSelectedId(t._id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedId(t._id);
              }
            }}
          >
            <span className="lab-table-name">
              <LabRowMark>{ticketMark(t.ticket_number)}</LabRowMark>
              <span className="lab-table-copy">
                <span className="lab-table-code">{t.ticket_number}</span>
                <span className="lab-table-title">{t.model_name}</span>
                <span className="lab-table-meta">
                  {t.customer_name}
                  {t.serial_number ? ` · SN ${t.serial_number}` : ''}
                </span>
              </span>
            </span>
            <span className="lab-table-cell">{t.customer_name || '—'}</span>
            <span className="lab-table-cell lab-col-extra">{t.symptom || '—'}</span>
            <span className="lab-table-status">
              <StatusPill variant={REPAIR_STATUS_PILL[t.status] || 'active'}>
                {REPAIR_STATUS_LABELS[t.status]}
              </StatusPill>
            </span>
            <span className="lab-table-cell lab-col-extra">{formatLabRelative(t.updatedAt || t.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <LabPageShell wide>
      <PageHeader
        className="lab-page-head"
        title="Sửa máy khách"
        subtitle={tickets.length ? `${tickets.length} phiếu trong lab` : 'Tiếp nhận và theo dõi sửa máy'}
      >
        <button type="button" className="btn-pill btn-pill--36 btn-pill--lv1" onClick={() => setShowCreate(true)}>
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

      <div className={selected ? 'max-lg:hidden' : ''}>
        <LabStatusRail items={railItems} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <LabMasterDetail
        selected={Boolean(selected)}
        listHidden={Boolean(selected)}
        detailHidden={!selected}
        onBack={() => setSelectedId(null)}
        backLabel="← Danh sách phiếu"
        toolbar={
          <>
            <div className="lab-desk__toolbar-search">
              <SearchField
                placeholder="Tìm phiếu"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
            <span className="lab-desk__count">
              {visible.length ? `Đang hiện ${rangeFrom}–${rangeTo} / ${visible.length}` : '0 phiếu'}
            </span>
          </>
        }
        list={listPanel}
        footer={pageCount > 1 ? <LabPager page={safePage} pageCount={pageCount} onChange={setPage} /> : null}
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
          ) : null
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
              className="btn-pill btn-pill--48 btn-pill--lv1 btn-pill--block"
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
