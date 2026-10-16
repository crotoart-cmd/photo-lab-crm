import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import FeedbackBanner from '../components/FeedbackBanner';
import SearchField from '../components/SearchField';
import StatusPill from '../components/StatusPill';
import SubNavBar from '../components/SubNavBar';
import AppleSegmentedControl from '../components/AppleSegmentedControl';
import LabPageShell from '../components/lab/LabPageShell';
import LabMasterDetail, { LabDetailEmpty, LabRowMark } from '../components/lab/LabMasterDetail';
import LabStatusRail, { LabPager } from '../components/lab/LabStatusRail';
import TicketSlip from '../components/TicketSlip';
import TicketDetailPanel from '../components/TicketDetailPanel';
import BatchDeliverModal from '../components/BatchDeliverModal';
import IntakeChecklistForm, { defaultIntakeChecklist } from '../components/IntakeChecklistForm';
import {
  STATUS_LABELS,
  FILM_STATUS_PILL,
  customerName,
  customerPhone,
  filmTypeLabel,
  ticketCode,
} from '../utils/filmLabels';
import { LAB_PAGE_SIZE, formatLabRelative, ticketMark } from '../utils/labFormat';
import { filmTypeFromDetail } from '../utils/intakeOptions';
import { LabeledTextarea } from '../components/formFields';
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
  { id: 'receive', label: 'Nhận cuộn' },
  { id: 'tracking', label: 'Theo dõi tráng' },
  { id: 'delivery', label: 'Trả ảnh' },
];

const TRACKING_FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'web_order', label: STATUS_LABELS.web_order },
  { id: 'received', label: STATUS_LABELS.received },
  { id: 'processing', label: STATUS_LABELS.processing },
  { id: 'completed', label: STATUS_LABELS.completed },
];

const RECEIVE_FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'web_order', label: STATUS_LABELS.web_order },
  { id: 'received', label: STATUS_LABELS.received },
];

export default function Films() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'receive');
  const [films, setFilms] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedId, setSelectedId] = useState(() => searchParams.get('id') || null);
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
  const [page, setPage] = useState(1);
  const lastIndexRef = useRef(null);

  const folderDefs = activeTab === 'receive' ? RECEIVE_FILTERS : activeTab === 'tracking' ? TRACKING_FILTERS : null;

  const tabBase = useMemo(() => {
    if (activeTab === 'receive') {
      return films.filter((f) => f.status === 'web_order' || f.status === 'received');
    }
    if (activeTab === 'delivery') return films.filter((f) => f.status === 'completed');
    return films.filter((f) => f.status !== 'delivered' && f.status !== 'cancelled');
  }, [films, activeTab]);

  const workflowItems = useMemo(
    () => [
      {
        id: 'receive',
        label: 'Nhận cuộn',
        count: films.filter((f) => f.status === 'web_order' || f.status === 'received').length,
      },
      {
        id: 'tracking',
        label: 'Theo dõi tráng',
        count: films.filter((f) => f.status !== 'delivered' && f.status !== 'cancelled').length,
      },
      {
        id: 'delivery',
        label: 'Trả ảnh',
        count: films.filter((f) => f.status === 'completed').length,
      },
    ],
    [films]
  );

  const folderItems = useMemo(() => {
    if (!folderDefs) return null;
    const counts = {};
    tabBase.forEach((f) => {
      counts[f.status] = (counts[f.status] || 0) + 1;
    });
    return folderDefs.map((tab) => ({
      ...tab,
      count: tab.id === '' ? tabBase.length : counts[tab.id] || 0,
    }));
  }, [folderDefs, tabBase]);

  const displayList = useMemo(() => {
    if (searchResults !== null) return searchResults;
    if (activeTab === 'delivery' || !statusFilter) return tabBase;
    return tabBase.filter((f) => f.status === statusFilter);
  }, [searchResults, tabBase, statusFilter, activeTab]);

  const pageCount = Math.max(1, Math.ceil(displayList.length / LAB_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = displayList.slice((safePage - 1) * LAB_PAGE_SIZE, safePage * LAB_PAGE_SIZE);
  const rangeFrom = displayList.length ? (safePage - 1) * LAB_PAGE_SIZE + 1 : 0;
  const rangeTo = Math.min(safePage * LAB_PAGE_SIZE, displayList.length);

  const canCheck = activeTab === 'tracking' || activeTab === 'delivery';

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
  const pageEligible = pageRows.filter(canSelectForBatch);
  const allChecked = pageEligible.length > 0 && pageEligible.every((film) => selectedIds.has(film._id));

  const selectRange = (toIndex) => {
    if (toIndex < 0) return;
    const from = lastIndexRef.current;
    if (from == null) {
      lastIndexRef.current = toIndex;
      const film = pageRows[toIndex];
      if (film && canSelectForBatch(film)) setSelectedIds(new Set([film._id]));
      return;
    }
    const start = Math.min(from, toIndex);
    const end = Math.max(from, toIndex);
    setSelectedIds((cur) => {
      const next = new Set(cur);
      for (let i = start; i <= end; i += 1) {
        const film = pageRows[i];
        if (film && canSelectForBatch(film)) next.add(film._id);
      }
      return next;
    });
  };

  const toggleSelect = (id, film, index) => {
    if (!canSelectForBatch(film)) return;
    lastIndexRef.current = index;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllEligible = () => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      pageEligible.forEach((film) => next.add(film._id));
      return next;
    });
    lastIndexRef.current = 0;
  };

  const clearPageEligible = () => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      pageEligible.forEach((film) => next.delete(film._id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    lastIndexRef.current = null;
  };

  const selectedFilm = displayList.find((f) => f._id === selectedId) || null;

  const loadFilms = useCallback(() => {
    return loadFilmsBridge({}).then(({ films: rows }) => {
      setFilms(rows);
      return rows;
    });
  }, []);

  useEffect(() => {
    loadEnrichedCustomers()
      .then(({ customers: list }) => setCustomers(list || []))
      .catch(() => {
        if (!isMobileDataEnabled()) {
          api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
        }
      });
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
    const tab = searchParams.get('tab');
    if (tab && TABS.some((t) => t.id === tab)) setActiveTab(tab);
    const id = searchParams.get('id');
    if (id) setSelectedId(id);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, statusFilter, searchQuery]);

  useEffect(() => {
    setSearchResults(null);
    if (!searchParams.get('id')) setSelectedId(null);
    clearSelection();
    if (activeTab === 'delivery') setStatusFilter('completed');
    else setStatusFilter('');
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
  }, [activeTab, loadFilms, searchParams]);

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
      if (data.failedCount === 0) setSuccess(data.message);
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
        setSuccess(data.message);
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
    <LabPageShell wide>
      <div className="max-md:hidden">
        <PageHeader className="lab-page-head" title="Phiếu film" subtitle={listTitle}>
          {activeTab === 'receive' ? (
            <button type="button" className="btn-pill btn-pill--36 btn-pill--lv1" onClick={() => setShowReceive(true)}>
              Tiếp nhận cuộn
            </button>
          ) : null}
        </PageHeader>
      </div>

      <SubNavBar
        className="md:hidden"
        mobileOnly
        sticky
        title={TABS.find((t) => t.id === activeTab)?.label || 'Phiếu film'}
        filter={activeTab === 'tracking' || activeTab === 'receive'}
        filterActive={Boolean(statusFilter && activeTab !== 'delivery')}
        filterVariant={activeTab === 'tracking' || activeTab === 'receive' ? 'icon' : 'button'}
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

      {folderItems && filterOpen && (
        <div className="md:hidden relative z-10 -mt-1 mb-3">
          <AppleSegmentedControl
            items={folderItems.map(({ id, label }) => ({ id, label }))}
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

      {error && (
        <div className="mb-4">
          <FeedbackBanner variant="error" onDismiss={() => setError('')}>
            {error}
          </FeedbackBanner>
        </div>
      )}

      <div className="max-md:hidden">
        <LabStatusRail
          label="Công đoạn"
          items={workflowItems}
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
      </div>

      <LabMasterDetail
        selected={Boolean(selectedFilm)}
        listHidden={Boolean(selectedFilm)}
        detailHidden={!selectedFilm}
        onBack={() => setSelectedId(null)}
        backLabel="← Danh sách phiếu"
        toolbar={
          <>
            <div className="lab-desk__mobile-tabs md:hidden">
              <AppleSegmentedControl
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
            </div>
            <div className="lab-desk__toolbar-search">
              <SearchField
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm phiếu"
                loading={searchLoading}
                aria-label="Tìm phiếu hoặc khách hàng"
              />
            </div>
            {folderItems ? (
              <div className="lab-status-chips max-md:hidden">
                {folderItems.map((item) => (
                  <button
                    key={item.id || 'all'}
                    type="button"
                    className={statusFilter === item.id ? 'is-on' : ''}
                    onClick={() => setStatusFilter(item.id)}
                  >
                    {item.label}
                    <span className="lab-filter-count">{item.count}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <span className="lab-desk__count">
              {displayList.length
                ? `Đang hiện ${rangeFrom}–${rangeTo} / ${displayList.length}`
                : '0 phiếu'}
            </span>
          </>
        }
        footer={pageCount > 1 ? <LabPager page={safePage} pageCount={pageCount} onChange={setPage} /> : null}
        list={
          <div className={`lab-table lab-table--film${canCheck ? ' lab-table--check' : ''}`}>
            <div className="lab-table-head">
              {canCheck ? (
                <input
                  type="checkbox"
                  className="shop-check"
                  checked={allChecked}
                  disabled={pageEligible.length === 0}
                  onChange={() => (allChecked ? clearPageEligible() : selectAllEligible())}
                  aria-label="Chọn tất cả phiếu hợp lệ"
                />
              ) : null}
              <span>Phiếu</span>
              <span>Liên hệ</span>
              <span className="lab-col-extra">Loại</span>
              <span>Trạng thái</span>
              <span className="lab-col-extra">Cập nhật</span>
            </div>
            {displayList.length === 0 && <div className="lab-table-empty">Không có phiếu</div>}
            {pageRows.map((film, index) => {
              const selectable = canSelectForBatch(film);
              const active = selectedId === film._id;
              const checked = selectedIds.has(film._id);
              const code = ticketCode(film);
              return (
                <div
                  key={film._id}
                  role="option"
                  tabIndex={0}
                  aria-selected={active}
                  className={`lab-table-row${active ? ' is-selected' : ''}${checked ? ' is-checked' : ''}`}
                  onClick={(e) => {
                    if (e.shiftKey && canCheck) {
                      e.preventDefault();
                      selectRange(index);
                      return;
                    }
                    setSelectedId(film._id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(film._id);
                    }
                  }}
                >
                  {canCheck ? (
                    <input
                      type="checkbox"
                      className="shop-check"
                      checked={checked}
                      disabled={!selectable}
                      aria-label={`Chọn ${code}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!e.shiftKey) return;
                        e.preventDefault();
                        selectRange(index);
                      }}
                      onChange={(e) => {
                        e.stopPropagation();
                        if (e.nativeEvent.shiftKey) return;
                        toggleSelect(film._id, film, index);
                      }}
                    />
                  ) : null}
                  <span className="lab-table-name">
                    <LabRowMark>{ticketMark(code)}</LabRowMark>
                    <span className="lab-table-copy">
                      <span className="lab-table-code">{code}</span>
                      <span className="lab-table-title">{customerName(film)}</span>
                      <span className="lab-table-meta">{customerPhone(film)}</span>
                    </span>
                  </span>
                  <span className="lab-table-cell">{customerPhone(film)}</span>
                  <span className="lab-table-cell lab-col-extra">
                    {filmTypeLabel(film.filmType)} · {film.quantity || 1}
                  </span>
                  <span className="lab-table-status">
                    <StatusPill variant={FILM_STATUS_PILL[film.status] || 'active'}>
                      {STATUS_LABELS[film.status]}
                    </StatusPill>
                  </span>
                  <span className="lab-table-cell lab-col-extra">
                    {formatLabRelative(film.updatedAt || film.createdAt)}
                  </span>
                </div>
              );
            })}
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
                ? 'Chọn phiếu sẵn sàng trả — tick nhiều phiếu để trả hàng loạt'
                : 'Chọn phiếu bên trái để xem tiến độ và bước tiếp theo'}
            </LabDetailEmpty>
          )
        }
      />

      {selectedIds.size > 0 && (
        <div className="shop-bulk-bar" role="toolbar" aria-label="Thao tác hàng loạt">
          <span className="shop-bulk-count">{selectedIds.size} phiếu</span>
          <button type="button" className="shop-product-tool" onClick={clearSelection}>
            Bỏ chọn
          </button>
          {activeTab === 'tracking' && selectedReceived.length > 0 && (
            <button
              type="button"
              disabled={batchLoading}
              onClick={handleBatchStart}
              className="btn-pill btn-pill--36 btn-pill--lv2"
            >
              Bắt đầu tráng ({selectedReceived.length})
            </button>
          )}
          {activeTab === 'tracking' && selectedProcessing.length > 0 && (
            <>
              <input
                type="text"
                className="lab-bulk-note"
                value={batchCompleteNotes}
                onChange={(e) => setBatchCompleteNotes(e.target.value)}
                placeholder="Ghi chú hoàn thành"
              />
              <button
                type="button"
                disabled={batchLoading}
                onClick={handleBatchComplete}
                className="btn-pill btn-pill--36 btn-pill--lv1"
              >
                Hoàn thành ({selectedProcessing.length})
              </button>
            </>
          )}
          {activeTab === 'delivery' && selectedCompleted.length > 0 && (
            <button
              type="button"
              disabled={batchLoading}
              onClick={() => setShowBatchDeliver(true)}
              className="btn-pill btn-pill--36 btn-pill--lv1"
            >
              Trả ảnh ({selectedCompleted.length})
            </button>
          )}
        </div>
      )}

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
