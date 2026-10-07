import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { scanSale, checkoutCart } from '../lib/mobileRetailBridge';

const itemUnitCost = (item) =>
  item.product_group === 'camera' ? num(item.true_cost, item.cost) : num(item.cost);

const itemEffectiveFloor = (item) => Math.max(num(item.floor_price), itemUnitCost(item));
import Modal from './Modal';
import CustomerSearchPicker from './CustomerSearchPicker';
import MobileCartCard from './retail/MobileCartCard';
import MobileSaleStockPanel from './retail/MobileSaleStockPanel';
import ProductScanSearchRow from './retail/ProductScanSearchRow';
import { parseNumericInput, fmtMoney, fmtMoneyDisplay, fmtMoneyDisplayBar, fmtMoneyShort, isMoneyCompact } from '../utils/retailPricing';
import { fullName } from '../utils/customerNormalize';
import { resolveCheckoutBuyer, hasCheckoutBuyerInfo } from '../utils/checkoutBuyer';
import IconChevron from './icons/IconChevron';
import { buildSaleSuccessToast } from '../utils/saleEmailToast';

const fmt = (n) => fmtMoney(n);
const num = (v, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

const SALE_GROUPS = [
  { id: 'camera', label: 'Máy ảnh', desc: 'Mã Serial độc nhất' },
  { id: 'film', label: 'Film ảnh', desc: 'Hãng + SKU master' },
  { id: 'battery', label: 'Pin máy ảnh', desc: 'SKU theo số lượng' },
];

let _cidSeq = 0;
const newCid = () => `cid-${++_cidSeq}-${Date.now()}`;

export default function SmartSalePanel({
  stockSummary,
  readyCameras = [],
  filmSkus = [],
  batteries = [],
  onSeedTestCameras,
  onCheckoutDone,
  onError,
  onSuccess,
}) {
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [activeGroup, setActiveGroup] = useState('camera');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [camHint, setCamHint] = useState('');
  const [checkoutLog, setCheckoutLog] = useState([]);
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [sheetH, setSheetH] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const fileRef = useRef(null);
  const checkoutBarRef = useRef(null);
  const sheetBarRef = useRef(null);
  const sheetGripRef = useRef(null);
  const sheetDragRef = useRef(null);

  /* ── Bottom sheet giỏ hàng — kéo grip để chỉnh chiều cao ── */
  const winH = () => (typeof window !== 'undefined' ? window.innerHeight : 800);
  // Chiều cao tối đa của vùng giỏ (cart scroll) — chừa chỗ cho grip, thanh bar,
  // tab bar và ~64px trống trên đầu để thấy nội dung phía sau.
  const sheetMax = () => {
    const barH = sheetBarRef.current?.offsetHeight ?? 72;
    const tabBarH = 56;
    const gripH = 24;
    const topGap = 64;
    const limit = winH() - barH - tabBarH - gripH - topGap;
    return Math.round(Math.max(winH() * 0.5, limit));
  };
  const sheetMid = () => Math.round(winH() * 0.4);

  const toggleSheet = useCallback(() => {
    setSheetH((h) => (h > 8 ? 0 : sheetMid()));
  }, []);

  const onSheetPointerDown = useCallback((e) => {
    sheetGripRef.current?.setPointerCapture?.(e.pointerId);
    sheetDragRef.current = { startY: e.clientY, startH: sheetH, cur: sheetH, moved: false };
    setSheetDragging(true);
  }, [sheetH]);

  const onSheetPointerMove = useCallback((e) => {
    const d = sheetDragRef.current;
    if (!d) return;
    const delta = d.startY - e.clientY;
    if (Math.abs(delta) > 4) d.moved = true;
    const next = Math.min(sheetMax(), Math.max(0, d.startH + delta));
    d.cur = next;
    setSheetH(next);
  }, []);

  const onSheetPointerUp = useCallback((e) => {
    const d = sheetDragRef.current;
    if (!d) return;
    sheetGripRef.current?.releasePointerCapture?.(e.pointerId);
    setSheetDragging(false);
    if (!d.moved) {
      toggleSheet();
    } else {
      const max = sheetMax();
      const mid = sheetMid();
      const cur = d.cur;
      let target = 0;
      if (cur > (mid + max) / 2) target = max;
      else if (cur > mid / 2) target = mid;
      setSheetH(target);
    }
    sheetDragRef.current = null;
  }, [toggleSheet]);

  /* ── helpers ── */
  const clearHint = useCallback(() => {
    onError?.('');
  }, [onError]);

  const addToCart = useCallback((apiItem) => {
    const item = {
      _cid: newCid(),
      product_group: apiItem.product_group,
      code: apiItem.code,
      camera_id: apiItem.camera_id,
      serial_number: apiItem.serial_number,
      name: apiItem.name,
      brand_group: apiItem.brand_group,
      condition_note: apiItem.condition_note || '',
      cost: num(apiItem.cost),
      true_cost: num(apiItem.true_cost, num(apiItem.cost)),
      total_repair_cost: num(apiItem.total_repair_cost),
      list_price: num(apiItem.list_price),
      offer_price: num(apiItem.list_price),
      floor_price: num(apiItem.floor_price),
      stock_qty: num(apiItem.stock_qty, 99),
      qty: num(apiItem.default_qty, 1),
      match_source: apiItem.match_source || 'scan',
    };

    setCart((prev) => {
      if (item.product_group === 'camera') {
        if (prev.some((c) => c.camera_id === item.camera_id)) return prev;
        return [...prev, item];
      }
      const existing = prev.find(
        (c) => c.product_group === item.product_group && c.code === item.code
      );
      if (existing) {
        return prev.map((c) =>
          c._cid === existing._cid ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, item];
    });
  }, []);

  /* ── scan barcode ── */
  const handleScan = useCallback(
    async (code) => {
      const c = String(code || '').trim();
      if (!c) return;
      setScanning(true);
      clearHint();
      try {
        const { data } = await scanSale(c);
        if (data.item?.sale_blocked) {
          onError?.(data.item.sale_block_reason || 'Máy chưa sẵn sàng bán');
          return;
        }
        addToCart(data.item);
        setScanInput('');
        onSuccess?.(`Đã thêm vào giỏ: ${data.item.name}`);
      } catch (err) {
        onError?.(err.message || err.response?.data?.message || `Không tìm thấy mã "${c}"`);
      } finally {
        setScanning(false);
      }
    },
    [addToCart, clearHint, onError, onSuccess]
  );

  /* ── camera barcode scanning ── */
  const stopCamera = useCallback(() => {
    if (timerRef.current) { cancelAnimationFrame(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  const closeCameraModal = useCallback(() => {
    setCameraOpen(false);
    stopCamera();
  }, [stopCamera]);

  const openGalleryForVision = () => {
    fileRef.current?.click();
  };

  const startCamera = useCallback(async () => {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamHint('Trình duyệt không hỗ trợ camera — gõ mã thủ công');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamHint('Đưa mã vạch sản phẩm vào khung hình...');

      const formats = ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a'];
      const detector = typeof window.BarcodeDetector !== 'undefined'
        ? new window.BarcodeDetector({ formats })
        : null;

      if (!detector) { setCamHint('Camera bật — gõ mã thủ công hoặc dán vào ô bên dưới'); return; }

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            closeCameraModal();
            await handleScan(codes[0].rawValue);
            return;
          }
        } catch { /* ignore frame */ }
        timerRef.current = requestAnimationFrame(tick);
      };
      timerRef.current = requestAnimationFrame(tick);
    } catch {
      setCamHint('Không mở được camera — kiểm tra quyền truy cập');
    }
  }, [stopCamera, handleScan, closeCameraModal]);

  useEffect(() => {
    if (cameraOpen) startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [cameraOpen, startCamera, stopCamera]);

  /* ── AI Vision for camera ── */
  const handleVisionFile = async (file) => {
    if (!file) return;
    closeCameraModal();
    setVisionLoading(true);
    clearHint();
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { data } = await api.post('/retail/smart-sale/vision', { image_base64: base64 });
      addToCart(data.item);
      const src = data.openai_configured ? 'GPT Vision' : 'mô phỏng';
      onSuccess?.(`AI (${src}) đã nhận diện: ${data.item.name} — SN ${data.item.serial_number}`);
    } catch (err) {
      onError?.(err.response?.data?.message || 'AI Vision thất bại');
    } finally {
      setVisionLoading(false);
    }
  };

  /* ── cart editing ── */
  const updateItem = (cid, field, value) =>
    setCart((prev) => prev.map((c) => (c._cid === cid ? { ...c, [field]: value } : c)));

  const removeItem = (cid) => setCart((prev) => prev.filter((c) => c._cid !== cid));

  /* ── checkout ── */
  const cartHasFloorViolation = cart.some(
    (c) => itemEffectiveFloor(c) > 0 && num(c.offer_price, c.list_price) < itemEffectiveFloor(c)
  );
  const totalRevenue = cart.reduce((s, c) => s + num(c.offer_price, c.list_price) * c.qty, 0);
  const totalProfit = cart.reduce(
    (s, c) => s + (num(c.offer_price, c.list_price) - itemUnitCost(c)) * c.qty,
    0
  );
  const cartCameraIds = useMemo(
    () => new Set(cart.filter((c) => c.product_group === 'camera' && c.camera_id).map((c) => c.camera_id)),
    [cart]
  );
  const cartSkuCodes = useMemo(() => {
    if (activeGroup === 'camera') return new Set();
    return new Set(
      cart
        .filter((c) => c.product_group === activeGroup)
        .map((c) => String(c.code || '').toUpperCase())
    );
  }, [cart, activeGroup]);
  const saleQuickStats = useMemo(() => {
    if (activeGroup === 'film') {
      const ready = filmSkus.filter((f) => Number(f.total_quantity) > 0);
      const totalQty = ready.reduce((s, f) => s + Number(f.total_quantity || 0), 0);
      return { left: { label: 'SKU sẵn', value: ready.length }, right: { label: 'Tổng cuộn', value: totalQty } };
    }
    if (activeGroup === 'battery') {
      const ready = batteries.filter((b) => Number(b.quantity) > 0);
      const totalQty = ready.reduce((s, b) => s + Number(b.quantity || 0), 0);
      return { left: { label: 'SKU sẵn', value: ready.length }, right: { label: 'Tổng pin', value: totalQty } };
    }
    return {
      left: { label: 'Sẵn hàng', value: stockSummary?.ready ?? readyCameras.length ?? 0, accent: true },
      right: { label: 'Đã bán', value: stockSummary?.sold ?? 0 },
    };
  }, [activeGroup, filmSkus, batteries, stockSummary, readyCameras.length]);

  const pickStockItem = useCallback(
    (item) => {
      if (activeGroup === 'camera') {
        handleScan(item.serial_number || item.camera_code);
        return;
      }
      handleScan(item.sku_code);
    },
    [activeGroup, handleScan]
  );
  const buyerReady = useMemo(
    () => hasCheckoutBuyerInfo({ selectedBuyer, buyerName, buyerEmail, fullName }),
    [selectedBuyer, buyerName, buyerEmail]
  );

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!buyerReady) {
      setCheckoutOpen(true);
      onError?.('Vui lòng nhập tên và email khách hàng trước khi thanh toán');
      return;
    }
    if (cartHasFloorViolation) {
      onError?.('Giỏ hàng có sản phẩm bị vi phạm giá sàn — hãy điều chỉnh giá offer trước khi thanh toán');
      return;
    }
    setCheckoutLoading(true);
    clearHint();

    try {
      const items = cart.map((item) => ({
        product_group: item.product_group,
        code: item.code,
        quantity: item.product_group === 'camera' ? 1 : item.qty,
        unit_price: num(item.offer_price, item.list_price),
        camera_id: item.camera_id,
        name: item.name,
      }));
      const { data } = await checkoutCart({
        items,
        ...resolveCheckoutBuyer({ selectedBuyer, buyerName, buyerEmail, fullName }),
      });

      const log = (data.log || []).map((r) => ({
        name: r.name,
        qty: r.qty,
        revenue: r.revenue,
        profit: r.profit,
        sale_code: r.sale_code,
        error: r.error,
        ok: r.ok,
      }));
      setCheckoutLog(log);

      const hasError = log.some((r) => !r.ok);
      if (!hasError) {
        const totalRevLog = log.reduce((s, r) => s + (r.revenue || 0), 0);
        const totalProfLog = log.reduce((s, r) => s + (r.profit || 0), 0);
        let msg = `Doanh thu ${fmt(totalRevLog)} · LN ${fmt(totalProfLog)}`;
        if (!buyerEmail.trim() && !selectedBuyer?.email && !data.emailSent && !data.emailError && !data.emailSkipped) {
          msg += ' (chưa nhập email khách)';
        }
        onSuccess?.(
          buildSaleSuccessToast({
            title: `Thanh toán thành công (${log.length} SP)`,
            subtitle: msg,
            email: data,
          })
        );
        setCart([]);
        setBuyerName('');
        setBuyerEmail('');
        setSelectedBuyer(null);
        onCheckoutDone?.();
      } else {
        onError?.('Một số sản phẩm lỗi khi xuất kho — xem chi tiết bên dưới');
      }
    } catch (err) {
      const partial = err.response?.data?.log;
      if (partial?.length) setCheckoutLog(partial);
      onError?.(err.message || err.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      setCheckoutLoading(false);
    }
  };

  /* ── render ── */
  const showMobileCheckout = cart.length > 0;

  useEffect(() => {
    if (cart.length === 0) {
      setCheckoutOpen(false);
      setSheetH(0);
    }
  }, [cart.length]);

  useEffect(() => {
    const root = document.documentElement;
    if (!showMobileCheckout) {
      root.classList.remove('retail-checkout-active');
      root.style.removeProperty('--retail-checkout-offset');
      return undefined;
    }
    root.classList.add('retail-checkout-active');
    const el = sheetBarRef.current;
    if (!el) return undefined;

    const sync = () => {
      root.style.setProperty('--retail-checkout-offset', `${el.offsetHeight}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.classList.remove('retail-checkout-active');
      root.style.removeProperty('--retail-checkout-offset');
    };
  }, [showMobileCheckout, checkoutOpen, cart.length, selectedBuyer, buyerName, buyerEmail]);

  const mobileCartBlock =
    cart.length === 0 ? (
      <div className="retail-pos-cart-empty">
        <span className="material-symbols-outlined retail-pos-cart-empty-icon" aria-hidden="true">
          shopping_cart
        </span>
        <p>Giỏ hàng đang trống</p>
        <p className="retail-mobile-cart-panel-hint">
          Chạm “+ Thêm” ở danh sách {activeGroup === 'camera' ? 'máy' : activeGroup === 'film' ? 'film' : 'pin'} phía trên hoặc quét mã để thêm vào giỏ.
        </p>
      </div>
    ) : (
      <div className="retail-pos-cart-list">
        {cart.map((item) => (
          <MobileCartCard
            key={item._cid}
            item={item}
            onChange={updateItem}
            onRemove={removeItem}
          />
        ))}
      </div>
    );

  return (
  <>
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) handleVisionFile(f);
        e.target.value = '';
      }}
    />

    {/* Mobile xếp dọc; desktop md+: Danh mục kho trái — quét + tồn + giỏ phải */}
    <div className="retail-pos-mobile retail-intake-mobile retail-sale-mobile">
      <div className="retail-intake-layout">
        <aside className="retail-intake-layout__aside">
          <section className="retail-intake-group-section" aria-label="Danh mục bán">
            <p className="retail-manual-section-title">Danh mục kho</p>
            <div className="retail-group-picker">
              {SALE_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGroup(g.id)}
                  className={`retail-group-btn ${activeGroup === g.id ? 'retail-group-btn-active' : ''}`}
                >
                  <p className="font-semibold retail-group-btn-title">{g.label}</p>
                  <p className="retail-group-btn-desc">{g.desc}</p>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="retail-intake-layout__main">
          <section className="intake-entry-cluster" aria-label="Thêm vào giỏ">
            <ProductScanSearchRow
              hideLabel
              hideLeadingIcon
              ariaLabel="Quét hoặc nhập mã"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onSubmit={handleScan}
              onOpenCamera={() => setCameraOpen(true)}
              loading={scanning || visionLoading}
            />
          </section>

          <div className="retail-pos-quick-stats" aria-label="Tồn kho theo danh mục">
            <div className="retail-pos-quick-stat">
              <span className="retail-pos-quick-stat-label">{saleQuickStats.left.label}</span>
              <span
                className={`retail-pos-quick-stat-value${
                  saleQuickStats.left.accent ? ' retail-pos-quick-stat-ready' : ''
                }`}
              >
                {saleQuickStats.left.value}
              </span>
            </div>
            <div className="retail-pos-quick-stat">
              <span className="retail-pos-quick-stat-label">{saleQuickStats.right.label}</span>
              <span className="retail-pos-quick-stat-value">{saleQuickStats.right.value}</span>
            </div>
          </div>

          <section className="retail-intake-stock-section" aria-label="Hàng sẵn bán">
            <MobileSaleStockPanel
              group={activeGroup}
              cameras={readyCameras}
              filmSkus={filmSkus}
              batteries={batteries}
              onSeed={activeGroup === 'camera' ? onSeedTestCameras : undefined}
              onPick={pickStockItem}
              inCartCameraIds={cartCameraIds}
              inCartCodes={cartSkuCodes}
              compact
            />
          </section>

          <section
            className={`retail-sale-cart-section${cart.length > 0 ? ' retail-sale-cart-section--filled' : ''}`}
            aria-label="Giỏ hàng"
          >
            <div
              className={`retail-mobile-cart-panel${cart.length > 0 ? ' retail-mobile-cart-panel--active' : ''}`}
            >
              <div className="retail-mobile-cart-panel-head">
                <div className="retail-mobile-cart-panel-head-main">
                  <span className="material-symbols-outlined retail-mobile-cart-panel-icon" aria-hidden="true">
                    shopping_cart
                  </span>
                  <p className="retail-mobile-cart-panel-title">
                    Giỏ hàng{cart.length > 0 ? ` · ${cart.length} SP` : ''}
                  </p>
                </div>
              </div>
              <div className="retail-pos-cart retail-sale-cart-zone retail-mobile-cart-panel-body">
                {mobileCartBlock}
              </div>
              {cart.length > 0 && (
                <div className="retail-sale-desk-checkout">
                  <div className="retail-sale-desk-checkout__buyer">
                    <CustomerSearchPicker
                      customerId={selectedBuyer?._id}
                      selectedCustomer={selectedBuyer}
                      onSelect={(c) => {
                        setSelectedBuyer(c);
                        setBuyerName(fullName(c));
                        setBuyerEmail(c.email || '');
                      }}
                      onClear={() => {
                        setSelectedBuyer(null);
                        setBuyerName('');
                        setBuyerEmail('');
                      }}
                    />
                    <div className="retail-sale-desk-checkout__buyer-fields">
                      <input
                        type="text"
                        className="ios-input text-xs rounded-lg border border-[var(--color-separator)] px-2 py-2"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Tên khách hàng"
                      />
                      <input
                        type="email"
                        className="ios-input text-xs rounded-lg border border-[var(--color-separator)] px-2 py-2"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        placeholder="Email phiếu BH"
                      />
                    </div>
                  </div>
                  <div className="retail-sale-desk-checkout__bar">
                    <div className="retail-sale-desk-checkout__totals">
                      <span className="retail-sheet__meta">
                        {cart.length} sp · LN {fmtMoneyShort(totalProfit)}
                      </span>
                      <span className="retail-checkout-total">{fmtMoneyDisplayBar(totalRevenue)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCheckout}
                      disabled={checkoutLoading || cartHasFloorViolation || !buyerReady}
                      className="retail-checkout-btn"
                    >
                      {checkoutLoading ? '...' : 'Thanh toán'}
                    </button>
                  </div>
                  {cartHasFloorViolation && (
                    <p className="retail-checkout-bar-warn">Có sản phẩm dưới giá sàn</p>
                  )}
                </div>
              )}
            </div>
          </section>

          {checkoutLog.length > 0 && (
            <div className="retail-pos-checkout-log">
              <p className="retail-pos-checkout-log-title">Kết quả thanh toán</p>
              {checkoutLog.map((r, i) => (
                <div key={i} className={`retail-pos-checkout-log-row ${r.ok ? 'ok' : 'err'}`}>
                  <span>{r.ok ? '✓' : '✗'} {r.name}</span>
                  {r.ok ? (
                    <span>
                      {fmt(r.revenue)} · +{fmt(r.profit)}
                    </span>
                  ) : (
                    <span>{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {cameraOpen && (
      <Modal title="Quét mã vạch / QR" onClose={closeCameraModal}>
        <div className="intake-scan-modal">
          <video
            ref={videoRef}
            className="intake-scan-modal__video"
            playsInline
            muted
          />
          <p className="intake-scan-modal__hint">
            {camHint || 'Đưa mã vạch sản phẩm vào khung hình...'}
          </p>
          <div className="intake-scan-modal__or" aria-hidden="true">
            <span>hoặc</span>
          </div>
          <button
            type="button"
            className="intake-scan-modal__gallery"
            onClick={openGalleryForVision}
            disabled={visionLoading}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              photo_library
            </span>
            <span>
              <strong>Chọn ảnh từ thư viện</strong>
              <small>AI nhận diện máy trong kho</small>
            </span>
          </button>
        </div>
      </Modal>
    )}

    {showMobileCheckout && (
      <div
        ref={checkoutBarRef}
        className={`retail-sheet${sheetDragging ? ' is-dragging' : ''}${
          sheetH > 8 ? ' is-expanded' : ''
        }`}
        style={{ '--retail-sheet-cart-h': `${sheetH}px` }}
        role="region"
        aria-label="Giỏ hàng và thanh toán"
      >
        <div
          ref={sheetGripRef}
          className="retail-sheet__grip-zone"
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          role="button"
          tabIndex={0}
          aria-label={sheetH > 8 ? 'Thu gọn giỏ hàng' : 'Mở giỏ hàng'}
          aria-expanded={sheetH > 8}
        >
          <span className="retail-sheet__grip" aria-hidden="true" />
        </div>

        <div className="retail-sheet__cart" aria-hidden={sheetH <= 8}>
          <div className="retail-sheet__cart-head">
            <span className="retail-cart-card-badge retail-sheet__cart-badge" aria-label={`Giỏ hàng, ${cart.length} sản phẩm`}>
              <span className="material-symbols-outlined" aria-hidden="true">shopping_cart_checkout</span>
              Trong giỏ
            </span>
          </div>
          <div className="retail-sheet__cart-scroll">
            <div className="retail-pos-cart-list">
              {cart.map((item) => (
                <MobileCartCard
                  key={item._cid}
                  item={item}
                  onChange={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </div>
        </div>

        <div ref={sheetBarRef} className="retail-sheet__bar">
          <div className="retail-sheet__bar-row">
            <div className="retail-sheet__total-zone">
              <button
                type="button"
                className={`retail-sheet__customer-chevron-btn${checkoutOpen ? ' is-active' : ''}${
                  buyerReady ? ' has-value' : ''
                }`}
                onClick={() => setCheckoutOpen((v) => !v)}
                aria-expanded={checkoutOpen}
                aria-label={checkoutOpen ? 'Ẩn khách hàng' : 'Thêm khách hàng'}
              >
                <IconChevron expanded={checkoutOpen} size={16} className="retail-sheet__total-chevron" />
              </button>
              <button
                type="button"
                className="retail-sheet__total-summary-btn"
                onClick={toggleSheet}
                aria-label={sheetH > 8 ? 'Thu gọn giỏ hàng' : 'Xem giỏ hàng'}
              >
                <span className="retail-sheet__meta">
                  {cart.length} sp · LN {fmtMoneyShort(totalProfit)}
                </span>
                <span
                  className="retail-checkout-total"
                  title={isMoneyCompact(totalRevenue, { bar: true }) ? fmtMoney(totalRevenue) : undefined}
                >
                  {fmtMoneyDisplayBar(totalRevenue)}
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={checkoutLoading || cartHasFloorViolation || !buyerReady}
              className="retail-checkout-btn"
            >
              {checkoutLoading ? '...' : 'Thanh toán'}
            </button>
          </div>

          {checkoutOpen && (
            <div className="retail-checkout-bar-details">
              <CustomerSearchPicker
                customerId={selectedBuyer?._id}
                selectedCustomer={selectedBuyer}
                onSelect={(c) => {
                  setSelectedBuyer(c);
                  setBuyerName(fullName(c));
                  setBuyerEmail(c.email || '');
                }}
                onClear={() => {
                  setSelectedBuyer(null);
                  setBuyerName('');
                  setBuyerEmail('');
                }}
              />
              <div className="grid grid-cols-2 gap-2 w-full">
                <input
                  type="text"
                  className="ios-input text-xs rounded-lg border border-[var(--color-separator)] px-2 py-2"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Tên khách hàng"
                />
                <input
                  type="email"
                  className="ios-input text-xs rounded-lg border border-[var(--color-separator)] px-2 py-2"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  placeholder="Email phiếu BH"
                />
              </div>
            </div>
          )}

          {cartHasFloorViolation && (
            <p className="retail-checkout-bar-warn">Có sản phẩm dưới giá sàn</p>
          )}
        </div>
      </div>
    )}
  </>
  );
}
