import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import FeedbackBanner from '../components/FeedbackBanner';
import SearchField from '../components/SearchField';
import StatusPill from '../components/StatusPill';
import SubNavBar from '../components/SubNavBar';
import AppleSegmentedControl from '../components/AppleSegmentedControl';
import LabPageShell from '../components/lab/LabPageShell';
import LabMasterDetail, { LabDetailEmpty } from '../components/lab/LabMasterDetail';
import TicketSlip from '../components/TicketSlip';
import TicketDetailPanel from '../components/TicketDetailPanel';
import BatchDeliverModal from '../components/BatchDeliverModal';
import IntakeChecklistForm, { defaultIntakeChecklist } from '../components/IntakeChecklistForm';
import {
  STATUS_LABELS,
  FILM_STATUS_PILL,
  customerName,
  customerPhone,
  ticketCode,
} from '../utils/filmLabels';
import { filmTypeFromDetail } from '../utils/intakeOptions';
import { inputClass, labelClass, LabeledTextarea } from '../components/formFields';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { isAuthError } from '../utils/apiError';
import {
  loadFilmsBridge,
  searchFilmsBridge,
  getFilmBridge,
  receiveFilmBridge,
  batchFilmStatusBridge,
  FILM_LAB_DATA_CHANGED,
} from '../lib/mobileFilmLabBridge';
import { loadEnrichedCustomers } from '../lib/mobileCustomerBridge';

const TABS = [
  { id: 'receive', label: 'Tiếp nhận' },
  { id: 'tracking', label: 'Theo dõi tráng' },
  { id: 'delivery', label: 'Trả ảnh' },
];

const TRACKING_FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'received', label: STATUS_LABELS.received },
  { id: 'processing', label: STATUS_LABELS.processing },
  { id: 'completed', label: STATUS_LABELS.completed },
];

export default function Films() {
  const [activeTab, setActiveTab] = useState('receive');
  const [films, setFilms] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [showReceive, setShowReceive] = useState(false);
  const [createdSlip, setCreatedSlip] = useState(null);
  const [receiveForm, setReceiveForm] = useState({
    customerId: '',
    receptionNotes: '',
    intake: defaultIntakeChecklist(),
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchDeliver, setShowBatchDeliver] = useState(false);
  const [batchCompleteNotes, setBatchCompleteNotes] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [emailSmtp, setEmailSmtp] = useState(null);

  const displayList = searchResults !== null ? searchResults : films;

  const canSelectForBatch = (film) => {
    if (activeTab === 'tracking') {
      if (statusFilter === 'received') return film.status === 'received';
      if (statusFilter === 'processing') return film.status === 'processing';
      return film.status === 'received' || film.status === 'processing';
    }
    if (activeTab === 'delivery') return film.status === 'completed';
    return false;
  };

  const selectedFilms = displayList.filter((f) => selectedIds.has(f._id));
  const selectedReceived = selectedFilms.filter((f) => f.status === 'received');
  const selectedProcessing = selectedFilms.filter((f) => f.status === 'processing');
  const selectedCompleted = selectedFilms.filter((f) => f.status === 'completed');

  const toggleSelect = (id, film) => {
    if (!canSelectForBatch(film)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEligible = () => {
    setSelectedIds(new Set(displayList.filter(canSelectForBatch).map((f) => f._id)));
  };

  const clearSelection = () => setSelectedIds(new Set());
  const selectedFilm = displayList.find((f) => f._id === selectedId) || null;

  const loadFilms = useCallback(() => {
    const params = {};
    if (activeTab === 'tracking' && statusFilter) params.status = statusFilter;
    if (activeTab === 'delivery') params.status = 'completed';
    return loadFilmsBridge(params).then(({ films }) => {
      setFilms(films);
      return films;
    });
  }, [activeTab, statusFilter]);

  useEffect(() => {
    loadEnrichedCustomers()
      .then(({ customers: list }) => setCustomers(list || []))
      .catch(() => {
        if (!isMobileDataEnabled()) {
          api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
        }
      });
    // Mobile native: không spam banner Mac SMTP (Y700/offline). Gửi mail = DeviceSmtp trên máy.
    if (isMobileDataEnabled()) {
      setEmailSmtp(null);
      return;
    }
    api
      .post('/email/verify')
      .then((res) => setEmailSmtp({ ok: true, message: res.data.message }))
      .catch((err) => {
        if (isAuthError(err)) return;
        setEmailSmtp({
          ok: false,
          message: err.response?.data?.message || 'SMTP chưa sẵn sàng',
        });
      });
  }, []);

  useEffect(() => {
    setSearchResults(null);
    setSelectedId(null);
    clearSelection();
    if (activeTab === 'delivery') {
      setStatusFilter('completed');
    } else if (activeTab === 'tracking') {
      setStatusFilter('');
    }
    loadFilms().catch((err) => {
      if (isMobileDataEnabled()) {
        setFilms([]);
        setError('');
        return;
      }
      if (isAuthError(err)) {
        setError('Phiên Mac hết hạn — mở Hồ sơ / đăng nhập lại để đồng bộ phiếu film');
        return;
      }
      setError('Không tải được danh sách phiếu');
    });
  }, [activeTab, statusFilter, loadFilms]);

  useEffect(() => {
    const onChanged = () => {
      loadFilms().catch(() => {});
    };
    window.addEventListener(FILM_LAB_DATA_CHANGED, onChanged);
    return () => window.removeEventListener(FILM_LAB_DATA_CHANGED, onChanged);
  }, [loadFilms]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return undefined;
    }

    const timer = setTimeout(() => {
      setSearchLoading(true);
      searchFilmsBridge(q)
        .then((data) => {
          setSearchResults(data);
          if (data.length === 1) {
            setSelectedId(data[0]._id);
          }
          const upper = q.toUpperCase();
          const byCode = data.find((f) => f.confirmationCode === upper);
          if (byCode) {
            setSelectedId(byCode._id);
            if (activeTab !== 'delivery') setActiveTab('delivery');
          }
        })
        .catch(() => setError('Tìm kiếm thất bại'))
        .finally(() => setSearchLoading(false));
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const refresh = async () => {
    const q = searchQuery.trim();
    if (q) {
      const data = await searchFilmsBridge(q);
      setSearchResults(data);
    } else {
      await loadFilms();
    }
    if (selectedId) {
      try {
        const data = await getFilmBridge(selectedId);
        if (q) {
          setSearchResults((prev) => (prev || []).map((f) => (f._id === selectedId ? data : f)));
        } else {
          setFilms((prev) => prev.map((f) => (f._id === selectedId ? data : f)));
        }
      } catch {
        setSelectedId(null);
      }
    }
  };

  const handleReceive = async (e) => {
    e.preventDefault();
    if (!receiveForm.customerId) {
      setError('Vui lòng chọn khách hàng');
      return;
    }
    const intake = receiveForm.intake;
    if (!intake.contactVerified || !intake.contactEmail?.trim()) {
      setError('Chọn khách hàng hoặc tick xác nhận email/SĐT ở mục 4');
      return;
    }
    try {
      const { quantity, ...checklistFields } = receiveForm.intake;
      const data = await receiveFilmBridge({
        customerId: receiveForm.customerId,
        quantity: quantity || 1,
        filmType: filmTypeFromDetail(receiveForm.intake.filmTypeDetail),
        receptionNotes: receiveForm.receptionNotes,
        intakeChecklist: checklistFields,
      });
      setShowReceive(false);
      setCreatedSlip(data.slip || data.film);
      if (data.emailError) {
        setError(`Phiếu đã tạo nhưng gửi email thất bại: ${data.emailError}`);
      } else if (data.emailSkipped || data.savedOnDevice) {
        setSuccess(data.message || 'Đã tạo phiếu trên máy');
      } else if (data.emailSent) {
        setSuccess(data.message || 'Đã tạo phiếu và gửi email xác nhận');
      } else {
        setSuccess(data.message || 'Đã tạo phiếu');
      }
      setReceiveForm({
        customerId: '',
        receptionNotes: '',
        intake: defaultIntakeChecklist(),
      });
      setSearchQuery('');
      setSearchResults(null);
      loadFilms();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Tạo phiếu thất bại';
      const detail = err.response?.data?.error;
      setError(detail ? `${msg}: ${detail}` : msg);
    }
  };

  const handleBatchStart = async () => {
    if (selectedReceived.length === 0) return;
    setBatchLoading(true);
    setError('');
    try {
      const data = await batchFilmStatusBridge(
        selectedReceived.map((f) => f._id),
        'processing'
      );
      clearSelection();
      await refresh();
      setError(
        data.failedCount > 0
          ? `${data.message}. Lỗi: ${data.failed.map((x) => x.message).join('; ')}`
          : ''
      );
      if (data.failedCount === 0) alert(data.message);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Batch tráng thất bại');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchComplete = async () => {
    if (selectedProcessing.length === 0) return;
    setBatchLoading(true);
    setError('');
    try {
      const data = await batchFilmStatusBridge(
        selectedProcessing.map((f) => f._id),
        'completed',
        { processingNotes: batchCompleteNotes || 'Hoàn thành tráng' }
      );
      clearSelection();
      setBatchCompleteNotes('');
      await refresh();
      if (data.failedCount > 0) {
        setError(`${data.message}. ${data.failed.length} phiếu lỗi.`);
      } else {
        alert(data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Batch hoàn thành thất bại');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDeliver = async (ids) => {
    setBatchLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await batchFilmStatusBridge(ids, 'delivered');
      setShowBatchDeliver(false);
      clearSelection();
      await refresh();
      if (data.failedCount > 0) {
        setError(
          `${data.message}. Chi tiết: ${data.failed
            .map((f) => `${f.id?.slice(-4)}: ${f.message}`)
            .join('; ')}`
        );
      } else {
        setSuccess(data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Batch trả ảnh thất bại');
    } finally {
      setBatchLoading(false);
    }
  };

  const handlePrint = () => {
    const el = document.getElementById('ticket-slip-print');
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Phiếu ${ticketCode(createdSlip)}</title></head><body>${el.outerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  const listTitle =
    searchResults !== null
      ? `Kết quả tìm kiếm (${searchResults.length})`
      : activeTab === 'delivery'
        ? 'Phiếu sẵn sàng trả'
        : 'Danh sách phiếu';

  return (
    <LabPageShell>
      <div className="max-md:hidden">
        <PageHeader title="Phiếu film">
          {activeTab === 'receive' && (
            <button type="button" onClick={() => setShowReceive(true)} className="apple-btn-primary">
              + Phiếu tiếp nhận
            </button>
          )}
        </PageHeader>
      </div>

      <SubNavBar
        className="md:hidden"
        mobileOnly
        sticky
        title={TABS.find((t) => t.id === activeTab)?.label || 'Phiếu film'}
        filter={activeTab === 'tracking'}
        filterActive={Boolean(statusFilter)}
        filterVariant={activeTab === 'tracking' ? 'icon' : 'button'}
        filterLabel="Lọc"
        onFilterClick={() => setFilterOpen((v) => !v)}
        rightAction={
          activeTab === 'receive'
            ? 'text'
            : activeTab === 'delivery' && selectedCompleted.length > 0
              ? 'icon'
              : null
        }
        rightLabel={activeTab === 'receive' ? 'Thêm' : 'Trả ảnh'}
        rightIcon="done_all"
        onRightClick={
          activeTab === 'receive'
            ? () => setShowReceive(true)
            : activeTab === 'delivery'
              ? () => setShowBatchDeliver(true)
              : undefined
        }
        centered={false}
      />

      {activeTab === 'tracking' && filterOpen && (
        <div className="md:hidden relative z-10 -mt-1 mb-3">
          <AppleSegmentedControl
            items={TRACKING_FILTERS}
            value={statusFilter}
            onChange={(id) => {
              setStatusFilter(id);
              setFilterOpen(false);
            }}
          />
        </div>
      )}

      {emailSmtp && !emailSmtp.ok && (
        <div className="apple-alert-error mb-4 text-sm">
          <strong>Email SMTP:</strong> {emailSmtp.message}
          <span className="block mt-1 text-xs opacity-90">
            Kiểm tra App Password 16 ký tự trong backend/.env rồi chạy npm run test:email
          </span>
        </div>
      )}

      {success && (
        <FeedbackBanner variant="success" onDismiss={() => setSuccess('')}>
          {success}
        </FeedbackBanner>
      )}

      <div className="mb-4">
        <SearchField
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Email, SĐT, mã phiếu PH-..."
          loading={searchLoading}
          aria-label="Tìm phiếu hoặc khách hàng"
        />
      </div>

      <AppleSegmentedControl
        className="mb-4"
        items={TABS}
        value={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setSearchQuery('');
          setSearchResults(null);
          setSelectedId(null);
          setFilterOpen(false);
          clearSelection();
        }}
      />

      {activeTab === 'tracking' && (
        <AppleSegmentedControl
          className="mb-4 max-md:hidden"
          items={TRACKING_FILTERS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      )}

      {error && (
        <div className="mb-4">
          <FeedbackBanner variant="error" onDismiss={() => setError('')}>
            {error}
          </FeedbackBanner>
        </div>
      )}

      {(activeTab === 'tracking' || activeTab === 'delivery') && (
        <div className="lab-toolbar">
          <span>
            Đã chọn: <strong className="text-[var(--color-label)]">{selectedIds.size}</strong> phiếu
          </span>
          <button type="button" onClick={selectAllEligible} className="apple-btn-ghost text-xs !py-1">
            Chọn tất cả (hợp lệ)
          </button>
          {selectedIds.size > 0 && (
            <button type="button" onClick={clearSelection} className="text-xs text-[var(--color-label-tertiary)] hover:underline">
              Bỏ chọn
            </button>
          )}
          {activeTab === 'tracking' && selectedReceived.length > 0 && (
            <button
              type="button"
              disabled={batchLoading}
              onClick={handleBatchStart}
              className="apple-btn-secondary ml-auto text-sm disabled:opacity-60"
            >
              Bắt đầu tráng ({selectedReceived.length})
            </button>
          )}
          {activeTab === 'tracking' && selectedProcessing.length > 0 && (
            <>
              <div className="max-w-[220px]">
                <label className={`${labelClass} text-[10px]`}>Ghi chú hoàn thành</label>
                <input
                  type="text"
                  value={batchCompleteNotes}
                  onChange={(e) => setBatchCompleteNotes(e.target.value)}
                  placeholder="Ghi chú chung..."
                  className={`${inputClass} text-xs py-2`}
                />
              </div>
              <button
                type="button"
                disabled={batchLoading}
                onClick={handleBatchComplete}
                className="apple-btn-primary !py-1.5 !px-3 text-sm disabled:opacity-60"
              >
                Hoàn thành & tạo folder ({selectedProcessing.length})
              </button>
            </>
          )}
          {activeTab === 'delivery' && selectedCompleted.length > 0 && (
            <button
              type="button"
              disabled={batchLoading}
              onClick={() => setShowBatchDeliver(true)}
              className="apple-btn-primary ml-auto !py-1.5 !px-3 text-sm disabled:opacity-60"
            >
              Xác nhận trả ảnh ({selectedCompleted.length})
            </button>
          )}
        </div>
      )}

      <LabMasterDetail
        listHidden={Boolean(selectedId)}
        detailHidden={!selectedId}
        onBack={() => setSelectedId(null)}
        backLabel="← Danh sách phiếu"
        list={
          <div className="lab-list-panel">
            <div className="lab-list-panel__header">
              <span>{listTitle}</span>
              {(activeTab === 'tracking' || activeTab === 'delivery') && (
                <span>Chọn nhiều phiếu</span>
              )}
            </div>
            <ul className="lab-list-panel__body divide-y divide-[var(--color-separator)]">
              {displayList.length === 0 && (
                <li className="p-6 text-center text-sm text-[var(--color-label-secondary)]">
                  Không có phiếu
                </li>
              )}
              {displayList.map((film) => {
                const selectable = canSelectForBatch(film);
                return (
                  <li key={film._id} className="flex items-stretch">
                    {(activeTab === 'tracking' || activeTab === 'delivery') && (
                      <label
                        className={`lab-list-row__check ${
                          selectable ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(film._id)}
                          disabled={!selectable}
                          onChange={() => toggleSelect(film._id, film)}
                          className="w-4 h-4 rounded border-[var(--color-separator)] accent-[var(--color-blue)]"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedId(film._id)}
                      className={`lab-list-row flex-1 ${
                        selectedId === film._id ? 'lab-list-row--selected' : ''
                      }`}
                    >
                      <div className="lab-list-row__main">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono text-sm font-semibold text-[var(--color-blue)]">
                            {ticketCode(film)}
                          </span>
                          <StatusPill variant={FILM_STATUS_PILL[film.status] || 'active'}>
                            {STATUS_LABELS[film.status]}
                          </StatusPill>
                        </div>
                        <p className="text-sm mt-1 text-[var(--color-label)]">{customerName(film)}</p>
                        <p className="text-xs text-[var(--color-label-secondary)]">{customerPhone(film)}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        }
        detail={
          selectedFilm ? (
            <TicketDetailPanel
              film={selectedFilm}
              onUpdated={refresh}
              onClose={() => setSelectedId(null)}
              focusDeliver={activeTab === 'delivery' && selectedFilm.status === 'completed'}
            />
          ) : (
            <LabDetailEmpty>
              {activeTab === 'delivery'
                ? 'Chọn phiếu sẵn sàng trả — bấm Xác nhận đã trả ảnh (gửi email khách)'
                : 'Chọn một phiếu trong danh sách hoặc tìm kiếm bên trên'}
            </LabDetailEmpty>
          )
        }
      />

      {showReceive && (
        <Modal
          wide
          title="Phiếu tiếp nhận — Checklist develop & scan"
          onClose={() => setShowReceive(false)}
        >
          <form onSubmit={handleReceive}>
            <IntakeChecklistForm
              checklist={receiveForm.intake}
              onChange={(patch) =>
                setReceiveForm((prev) => ({
                  ...prev,
                  intake: { ...prev.intake, ...patch },
                }))
              }
              customers={customers}
              customerId={receiveForm.customerId}
              onCustomerChange={(customerId, contactPatch, customer) => {
                setReceiveForm((prev) => ({
                  ...prev,
                  customerId,
                  intake: { ...prev.intake, ...contactPatch },
                }));
                if (customer) {
                  setCustomers((prev) =>
                    prev.some((c) => c._id === customer._id) ? prev : [...prev, customer]
                  );
                }
              }}
            />
            <div className="intake-checklist-form__footer">
            <LabeledTextarea
              label="Ghi chú tiếp nhận"
              value={receiveForm.receptionNotes}
              onChange={(e) => setReceiveForm({ ...receiveForm, receptionNotes: e.target.value })}
              placeholder="Ghi chú chung (tùy chọn)..."
              rows={2}
            />
            <button type="submit" className="apple-btn-primary w-full intake-checklist-form__submit">
              Hoàn tất checklist & tạo phiếu
            </button>
            </div>
          </form>
        </Modal>
      )}

      {showBatchDeliver && selectedCompleted.length > 0 && (
        <BatchDeliverModal
          films={selectedCompleted}
          loading={batchLoading}
          onClose={() => setShowBatchDeliver(false)}
          onSubmit={handleBatchDeliver}
        />
      )}

      {createdSlip && (
        <Modal wide title="Phiếu tiếp nhận đã tạo" onClose={() => setCreatedSlip(null)}>
          <TicketSlip film={createdSlip} onPrint={handlePrint} />
          <button
            type="button"
            onClick={() => {
              setSelectedId(createdSlip._id);
              setCreatedSlip(null);
              setActiveTab('tracking');
            }}
            className="apple-btn-ghost w-full mt-4"
          >
            Theo dõi phiếu này →
          </button>
        </Modal>
      )}
    </LabPageShell>
  );
}
