import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import Modal from './Modal';
import SearchField, { SearchFieldAction, SearchFieldRow, SearchFieldRowAction } from './SearchField';
import { parseCustomerQrPayload } from '../utils/customerQr';
import { isStrongMatch, rankCustomers } from '../utils/customerSearchRank';
import { inputClass, labelClass, textareaClass } from './formFields';
import { isMobileDataEnabled } from '../lib/mobileLocalDb';
import { searchCustomersLocal, getCachedEnrichedCustomers } from '../lib/mobileCustomerBridge';
import { CustomerQrIcon } from './icons/rowActionIcon';

function customerLabel(c) {
  if (!c) return '';
  return `${c.firstName} ${c.lastName}`.trim();
}

export default function CustomerSearchPicker({ customerId, selectedCustomer, onSelect, onClear }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const [qrPaste, setQrPaste] = useState('');
  const [scanning, setScanning] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);

  const rankedResults = useMemo(
    () => rankCustomers(query, results),
    [query, results]
  );

  const bestMatchId = useMemo(() => {
    const top = rankedResults[0];
    if (!top || !isStrongMatch(top)) return null;
    return top._id;
  }, [rankedResults]);

  const applyCustomer = useCallback(
    (customer) => {
      if (!customer) return;
      onSelect(customer);
      setQuery('');
      setResults([]);
      setOpen(false);
      setError('');
      setHighlightIndex(0);
    },
    [onSelect]
  );

  const selectByIndex = useCallback(
    (index) => {
      const c = rankedResults[index];
      if (c) applyCustomer(c);
    },
    [rankedResults, applyCustomer]
  );

  const lookupCustomer = useCallback(
    async (params) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/customers/lookup', { params });
        applyCustomer(data);
        setShowQr(false);
        return data;
      } catch (err) {
        if (isMobileDataEnabled()) {
          const cached = getCachedEnrichedCustomers();
          const found =
            cached.find((c) => params.id && String(c._id) === String(params.id)) ||
            cached.find((c) => params.code && c.customerCode === String(params.code).toUpperCase()) ||
            cached.find((c) => params.email && c.email === String(params.email).toLowerCase()) ||
            cached.find((c) => params.phone && String(c.phone).includes(String(params.phone).replace(/\D/g, '')));
          if (found) {
            applyCustomer(found);
            setShowQr(false);
            return found;
          }
        }
        setError(err.response?.data?.message || 'Không tìm thấy khách');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [applyCustomer]
  );

  const handleQrPayload = useCallback(
    async (raw) => {
      const parsed = parseCustomerQrPayload(raw);
      if (parsed.id) return lookupCustomer({ id: parsed.id });
      if (parsed.code) return lookupCustomer({ code: parsed.code });
      if (parsed.email) return lookupCustomer({ email: parsed.email });
      if (parsed.phone) return lookupCustomer({ phone: parsed.phone });
      if (parsed.raw) {
        const { data } = await api.get('/customers/search', { params: { q: parsed.raw } });
        const ranked = rankCustomers(parsed.raw, data);
        if (ranked.length === 1) return applyCustomer(ranked[0]);
        if (ranked.length > 1) {
          setResults(data);
          setOpen(true);
          setHighlightIndex(0);
          return null;
        }
      }
      setError('Không nhận diện được mã QR. Thử dán lại hoặc tìm bằng SĐT/email.');
      return null;
    },
    [lookupCustomer, applyCustomer]
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (isMobileDataEnabled()) {
          const local = searchCustomersLocal(q, getCachedEnrichedCustomers());
          setResults(local);
          setOpen(true);
          setHighlightIndex(0);
          return;
        }
        const { data } = await api.get('/customers/search', { params: { q } });
        setResults(data);
        setOpen(true);
        setHighlightIndex(0);
      } catch {
        if (isMobileDataEnabled()) {
          const local = searchCustomersLocal(q, getCachedEnrichedCustomers());
          setResults(local);
          setOpen(local.length > 0);
        } else {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, isMobileDataEnabled() ? 80 : 280);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [rankedResults.length, query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const onInputKeyDown = (e) => {
    if (!open || rankedResults.length === 0) {
      if (e.key === 'Enter' && query.trim().length >= 2) {
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, rankedResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectByIndex(highlightIndex);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      cancelAnimationFrame(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Trình duyệt không hỗ trợ camera. Dán nội dung QR bên dưới.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      setError('');

      const detector =
        typeof window.BarcodeDetector !== 'undefined'
          ? new window.BarcodeDetector({ formats: ['qr_code'] })
          : null;

      if (!detector) {
        setError('Camera bật — hãy dán mã QR thủ công nếu không tự quét được.');
        return;
      }

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            stopCamera();
            await handleQrPayload(codes[0].rawValue);
            return;
          }
        } catch {
          // ignore
        }
        scanTimerRef.current = requestAnimationFrame(tick);
      };
      scanTimerRef.current = requestAnimationFrame(tick);
    } catch {
      setError('Không mở được camera. Cho phép quyền camera hoặc dán mã QR.');
    }
  }, [stopCamera, handleQrPayload]);

  useEffect(() => {
    if (showQr) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [showQr, startCamera, stopCamera]);

  const display = selectedCustomer || null;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div className="space-y-2" ref={containerRef}>
      {display ? (
        <div className="flex items-start justify-between gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div>
            <p className="font-medium text-emerald-900">{customerLabel(display)}</p>
            <p className="text-xs text-emerald-800 mt-0.5">
              {display.phone} · {display.email}
            </p>
            {display.customerCode && (
              <p className="text-xs font-mono text-emerald-700 mt-1">Mã: {display.customerCode}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              onClear?.();
              setQuery('');
              setOpen(false);
            }}
            className="text-xs text-red-600 hover:underline shrink-0"
          >
            Đổi khách
          </button>
        </div>
      ) : (
        <>
          <label className={`${labelClass} mb-1 block`}>Tìm khách hàng</label>
          <SearchFieldRow
            className="search-field-row--bleed"
            actions={
              <SearchFieldRowAction
                primary
                onClick={() => setShowQr(true)}
                aria-label="Quét QR từ app khách hàng"
                title="Quét QR từ app khách hàng"
              >
                <CustomerQrIcon />
              </SearchFieldRowAction>
            }
          >
            <div className="relative">
              <SearchField
                inputRef={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => {
                  if (query.trim().length >= 2) setOpen(true);
                }}
                onKeyDown={onInputKeyDown}
                placeholder="SĐT, email, tên hoặc mã KH..."
                loading={loading}
                autoComplete="off"
                role="combobox"
                aria-expanded={showDropdown}
                aria-haspopup="listbox"
                trailing={
                  <SearchFieldAction
                    tabIndex={-1}
                    className={showDropdown ? 'search-field-action--open' : ''}
                    onClick={() => {
                      setOpen((v) => !v);
                      inputRef.current?.focus();
                    }}
                    aria-label="Mở danh sách gợi ý"
                  >
                    <span className="material-symbols-outlined search-field-chevron">expand_more</span>
                  </SearchFieldAction>
                }
              />

              {showDropdown && (
                <div className="apple-menu apple-menu--anchored" role="listbox">
                  {loading && <p className="apple-menu__empty">Đang tìm...</p>}

                  {!loading && rankedResults.length > 0 && (
                    <>
                      {bestMatchId && <p className="apple-menu__hint">Gợi ý khớp nhất</p>}
                      <div className="apple-menu__scroll">
                        {rankedResults.map((c, index) => (
                          <button
                            key={c._id}
                            type="button"
                            role="option"
                            aria-selected={index === highlightIndex}
                            className={`apple-menu__item${
                              index === highlightIndex ? ' apple-menu__item--highlight' : ''
                            }`}
                            onMouseEnter={() => setHighlightIndex(index)}
                            onClick={() => applyCustomer(c)}
                          >
                            <span className="apple-menu__item-label">
                              <span className="flex items-start justify-between gap-2">
                                <span className="font-medium">{customerLabel(c)}</span>
                                {c._id === bestMatchId && (
                                  <span className="shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-[var(--color-blue)] text-white">
                                    Khớp nhất
                                  </span>
                                )}
                              </span>
                              <span className="apple-menu__item-meta">
                                {c.phone} · {c.email}
                                {c.customerCode ? ` · ${c.customerCode}` : ''}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="apple-menu__empty text-[11px] !py-2 border-t border-[var(--color-separator)]">
                        ↑↓ chọn · Enter xác nhận · Esc đóng
                      </p>
                    </>
                  )}

                  {!loading && rankedResults.length === 0 && (
                    <p className="apple-menu__empty">Không có kết quả — thêm khách ở menu Khách hàng.</p>
                  )}
                </div>
              )}
            </div>
          </SearchFieldRow>

          <p className="text-xs text-slate-500">
            Gõ SĐT/email để xổ danh sách — dòng được <span className="text-[var(--color-blue)] font-medium">tô sáng</span>{' '}
            là kết quả đang chọn.
          </p>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </>
      )}

      {showQr && (
        <Modal title="Quét QR khách hàng" onClose={() => setShowQr(false)}>
          <div className="space-y-3">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center text-white text-sm p-4 text-center">
                  Đang khởi động camera...
                </div>
              )}
              <div className="absolute inset-8 border-2 border-white/60 rounded-lg pointer-events-none" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className={labelClass}>Hoặc dán nội dung QR từ app</label>
              <textarea
                value={qrPaste}
                onChange={(e) => setQrPaste(e.target.value)}
                placeholder="labstart://customer/KH-000001"
                className={`${textareaClass} font-mono text-xs min-h-[72px]`}
                rows={3}
              />
              <button
                type="button"
                disabled={!qrPaste.trim() || loading}
                onClick={() => handleQrPayload(qrPaste)}
                className="mt-2 w-full bg-lab-600 text-white py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Xác nhận mã đã dán
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
