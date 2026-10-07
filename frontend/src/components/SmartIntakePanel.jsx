import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client';
import { confirmIntake, isMobileDataEnabled } from '../lib/mobileRetailBridge';
import CameraConditionFields from './camera/CameraConditionFields';
import CameraDetailModal from './camera/CameraDetailModal';
import { apiErrorMessage, isApiRouteMissing } from '../utils/apiError';
import { getApiBaseUrl } from '../config/apiBase';
import {
  cameraEntryToIntake,
  filmEntryToIntake,
  findCameraEntry,
  findFilmEntry,
} from '../lib/masterCatalogClient';
import Modal from './Modal';
import PriceFieldsRow from './PriceFieldsRow';
import ProductScanSearchRow from './retail/ProductScanSearchRow';
import IconLoading from './icons/IconLoading';
import RefreshButton from './RefreshButton';
import { ICON_SIZE } from './icons/iconSizes';
import IntakeStockList from './retail/IntakeStockList';
import { buildCounterCodeLocal } from '../utils/cameraStockDisplay';
import { printCameraCounterLabel } from '../utils/printCameraCounterLabel';
import masterFilmCatalog from '../data/masterFilmCatalog.json';
import {
  inputClass,
  inputClassDark,
  labelClass,
  LabeledInput,
  LabeledSearchableSelect,
  LabeledSelect,
  LabeledTextarea,
} from './formFields';
import masterCameraCatalog from '../data/masterCameraCatalog.json';

const formatMoney = (n) => Number(n || 0).toLocaleString('vi-VN') + ' đ';

const EMPTY = {
  product_group: 'film',
  sku_code: '',
  camera_code: '',
  serial_number: '',
  barcode: '',
  name: '',
  brand: '',
  brand_group: '',
  category_cluster: '',
  battery_type: '',
  iso: '',
  size: '35mm',
  cost: 0,
  price: 0,
  floor_price: 0,
  condition_note: '',
  has_defect: false,
  defect_tags: [],
  condition_grade: 'A',
  note: '',
  source: '',
  quantity: 1,
  expiry_date: '',
  catalog_key: '',
  camera_type: '',
  film_type: '',
  exposures: '',
  color_character: '',
  serial_is_generated: false,
  estimated_year: '',
};

const GROUPS = [
  { id: 'camera', label: 'Máy ảnh', desc: 'Mã Serial độc nhất' },
  { id: 'film', label: 'Film ảnh', desc: 'Hãng + SKU master' },
  { id: 'battery', label: 'Pin máy ảnh', desc: 'SKU theo số lượng' },
];

const VISION_SOURCES = new Set(['openai_vision', 'vision_mock', 'google_simulated']);
const CAMERA_TYPE_LABELS = {
  SLR: 'SLR',
  Rangefinder: 'Rangefinder (RF)',
  PnS: 'PnS',
  TLR: 'TLR',
  Other: 'Khác',
};
const VISION_UNCERTAIN_FIELDS = [
  'name',
  'model_name',
  'serial_number',
  'cost',
  'price',
  'condition_note',
  'brand',
];

function buildManualTemplate(group) {
  const exp = new Date();
  exp.setMonth(exp.getMonth() + 18);
  return {
    ...EMPTY,
    product_group: group,
    source: 'manual',
    name: group === 'battery' ? 'Pin LR44 vỉ' : '',
    model_name: group === 'camera' ? '' : undefined,
    note: '',
    expiry_date: group === 'film' ? exp.toISOString().slice(0, 10) : '',
    sku_code: group === 'battery' ? `BAT-NEW-${Date.now().toString(36).slice(-4).toUpperCase()}` : '',
    quantity: group === 'camera' ? 1 : 10,
    cost: group === 'camera' ? 3500000 : group === 'battery' ? 50000 : 130000,
    price: group === 'camera' ? 5000000 : group === 'battery' ? 90000 : 180000,
    floor_price: group === 'camera' ? 3500000 : group === 'battery' ? 50000 : 130000,
  };
}

function cameraModelLabel(entry) {
  if (!entry) return '';
  if (entry.modelShort) return entry.modelShort;
  const brand = String(entry.brand || '').trim();
  const model = String(entry.model || '').trim();
  if (brand && model.toLowerCase().startsWith(brand.toLowerCase())) {
    return model.slice(brand.length).trim() || model;
  }
  return model;
}

function filmStockLabel(entry) {
  if (!entry) return '';
  const brand = String(entry.brand || '').trim();
  const name = String(entry.name || '').trim();
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
    return name.slice(brand.length).trim() || name;
  }
  return name;
}

function pickCatalogList(apiList, bundledList) {
  if (!Array.isArray(apiList) || apiList.length === 0) return bundledList;
  return apiList.length >= bundledList.length ? apiList : bundledList;
}

export default function SmartIntakePanel({
  defaultGroup = 'camera',
  filmRows = [],
  batteryRows = [],
  cameraRows = [],
  onSeedTestCameras,
  onSaved,
  onError,
  onSuccess,
}) {
  const [scanInput, setScanInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState(() => buildManualTemplate(
    ['camera', 'film', 'battery'].includes(defaultGroup) ? defaultGroup : 'camera',
  ));
  const [showCamera, setShowCamera] = useState(false);
  const [cameraHint, setCameraHint] = useState('');
  const [panelError, setPanelError] = useState('');
  const [cameraModels, setCameraModels] = useState(masterCameraCatalog);
  const [filmStocks, setFilmStocks] = useState(masterFilmCatalog);
  const [serialCheck, setSerialCheck] = useState(null);
  const [filmFormat, setFilmFormat] = useState('35mm');
  const [activeGroup, setActiveGroup] = useState(() =>
    ['camera', 'film', 'battery'].includes(defaultGroup) ? defaultGroup : 'camera',
  );
  const [lowConfidenceFields, setLowConfidenceFields] = useState(() => new Set());
  const [activeStockRowId, setActiveStockRowId] = useState(null);
  const [detailCameraId, setDetailCameraId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const formZoneRef = useRef(null);
  const pendingFocusRef = useRef(null);

  const clearUncertain = (field) => {
    setLowConfidenceFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const uncertainClass = (field, base = '') =>
    lowConfidenceFields.has(field) ? `${base} intake-input-uncertain`.trim() : base;

  const selectGroup = (groupId) => {
    setActiveGroup(groupId);
    setActiveStockRowId(null);
    setLowConfidenceFields(new Set());
    setSerialCheck(null);
    setPanelError('');
    setDetected(buildManualTemplate(groupId));
  };

  const resetToManualForm = (group = activeGroup) => {
    setActiveStockRowId(null);
    setLowConfidenceFields(new Set());
    setSerialCheck(null);
    setDetected(buildManualTemplate(group));
  };

  const reportError = (msg) => {
    setPanelError(msg || '');
    onError?.(msg || '');
  };

  const reportRequestError = (err, fallback) => {
    if (isApiRouteMissing(err)) {
      reportError(
        `API nhập kho không tìm thấy (404) — kiểm tra backend: cd backend && npm start (port 5001). URL: ${getApiBaseUrl()}`
      );
      return;
    }
    reportError(apiErrorMessage(err, fallback));
  };

  const reportSuccess = (msg) => {
    setPanelError('');
    onSuccess?.(msg);
  };

  useEffect(() => {
    if (!['camera', 'film', 'battery'].includes(defaultGroup)) return;
    setActiveGroup(defaultGroup);
    setDetected(buildManualTemplate(defaultGroup));
    setActiveStockRowId(null);
    setLowConfidenceFields(new Set());
    setSerialCheck(null);
  }, [defaultGroup]);

  useEffect(() => {
    api
      .get('/retail/catalog/camera-models')
      .then((res) => setCameraModels((prev) => pickCatalogList(res.data, prev)))
      .catch(() => {});
    api
      .get('/retail/catalog/film-stocks')
      .then((res) => setFilmStocks((prev) => pickCatalogList(res.data, prev)))
      .catch(() => {});
  }, []);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const fileRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) {
      cancelAnimationFrame(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const closeCameraModal = useCallback(() => {
    setShowCamera(false);
    stopCamera();
  }, [stopCamera]);

  const applyDetected = (data, { fromVision = false, focusQuantity = false } = {}) => {
    const d = data.detected || data;
    setDetected({
      ...EMPTY,
      ...d,
      product_group: d.product_group || activeGroup,
      quantity: Math.max(1, Number(d.quantity) || 1),
      expiry_date: d.expiry_date ? String(d.expiry_date).slice(0, 10) : '',
    });
    setActiveStockRowId(null);
    setLowConfidenceFields(fromVision ? new Set(VISION_UNCERTAIN_FIELDS) : new Set());
    if (focusQuantity) pendingFocusRef.current = 'quantity';
    if (fromVision && d.product_group === 'camera') pendingFocusRef.current = 'serial_number';
    if (d.product_group) setActiveGroup(d.product_group);
    requestAnimationFrame(() => {
      formZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const handleBarcodeScan = useCallback(
    async (code) => {
      const c = String(code || scanInput).trim();
      if (!c) return;
      setAiLoading(true);
      reportError('');
      try {
        const { data } = await api.post('/retail/smart-intake/scan', { code: c });
        const src = data.detected?.source || data.ai_mode;
        applyDetected(data, {
          fromVision: VISION_SOURCES.has(src),
          focusQuantity: true,
        });
        setScanInput(c);
      } catch (err) {
        reportRequestError(err, 'Quét mã thất bại');
      } finally {
        setAiLoading(false);
      }
    },
    [scanInput]
  );

  const handleVisionFile = async (file) => {
    if (!file) return;
    closeCameraModal();
    setAiLoading(true);
    reportError('');
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data } = await api.post('/retail/smart-intake/vision', {
        image_base64: base64,
      });
      applyDetected(data, { fromVision: true });
      if (!data.openai_configured) {
        setCameraHint('Đang dùng mô phỏng — thêm OPENAI_API_KEY để Vision thật');
      } else {
        setCameraHint('GPT Vision đã phân tích ảnh');
      }
    } catch (err) {
      reportRequestError(err, 'AI Vision thất bại');
    } finally {
      setAiLoading(false);
    }
  };

  const openGalleryForVision = () => {
    fileRef.current?.click();
  };

  const startBarcodeCamera = useCallback(async () => {
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraHint('Trình duyệt không hỗ trợ camera — gõ mã thủ công');
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
      setCameraHint('Đưa mã vạch vào khung hình...');

      const formats = ['ean_13', 'ean_8', 'code_128', 'qr_code', 'upc_a'];
      const detector =
        typeof window.BarcodeDetector !== 'undefined'
          ? new window.BarcodeDetector({ formats })
          : null;

      if (!detector) {
        setCameraHint('Camera bật — gõ mã hoặc dán vào ô bên trên');
        return;
      }

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            closeCameraModal();
            await handleBarcodeScan(codes[0].rawValue);
            return;
          }
        } catch {
          // ignore frame errors
        }
        scanTimerRef.current = requestAnimationFrame(tick);
      };
      scanTimerRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraHint('Không mở được camera — kiểm tra quyền truy cập');
    }
  }, [stopCamera, handleBarcodeScan, closeCameraModal]);

  useEffect(() => {
    if (showCamera) startBarcodeCamera();
    else stopCamera();
    return () => stopCamera();
  }, [showCamera, startBarcodeCamera, stopCamera]);

  const updateField = (key, value) => {
    clearUncertain(key);
    setDetected((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!detected || !pendingFocusRef.current) return;
    const target = pendingFocusRef.current;
    pendingFocusRef.current = null;
    const sel =
      target === 'serial_number'
        ? '[data-intake-focus="serial"]'
        : '[data-intake-focus="qty"]';
    formZoneRef.current?.querySelector(sel)?.focus();
  }, [detected]);

  const applyFilmCatalog = async (catalogKey, format = filmFormat) => {
    if (!catalogKey) return;
    const local = findFilmEntry(catalogKey, filmStocks);
    const fmt = format || local?.formats?.[0] || '35mm';
    if (local) {
      applyDetected({ detected: filmEntryToIntake(local, fmt) });
      setFilmFormat(fmt);
      return;
    }
    try {
      const { data } = await api.post('/retail/catalog/apply-film-stock', {
        catalog_key: catalogKey,
        format: fmt,
      });
      applyDetected(data);
      setFilmFormat(data.detected?.size === '120' ? '120' : data.detected?.size === '110' ? '110' : '35mm');
    } catch (err) {
      reportRequestError(err, 'Không tải catalog film');
    }
  };

  const applyCameraCatalog = async (catalogKey) => {
    if (!catalogKey) return;
    setSerialCheck(null);
    const local = findCameraEntry(catalogKey, cameraModels);
    if (local) {
      applyDetected({ detected: cameraEntryToIntake(local) });
    } else {
      try {
        const { data } = await api.post('/retail/catalog/apply-camera-model', { catalog_key: catalogKey });
        applyDetected(data);
      } catch (err) {
        reportRequestError(err, 'Không tải catalog máy');
        return;
      }
    }
    await generateCounterCode(catalogKey);
  };

  const checkCameraSerial = async () => {
    if (!detected?.catalog_key || !detected?.serial_number) return;
    const entry = findCameraEntry(detected.catalog_key, cameraModels);
    if (entry?.serialValidation === 'none') {
      setSerialCheck(null);
      return;
    }
    try {
      const { data } = await api.post('/retail/catalog/validate-camera-serial', {
        catalog_key: detected.catalog_key,
        serial_number: detected.serial_number,
      });
      setSerialCheck(data.valid ? null : data);
    } catch (err) {
      reportRequestError(err, 'Kiểm tra sê-ri thất bại');
    }
  };

  const generateCounterCode = useCallback(
    async (catalogKey) => {
      if (!catalogKey) return;
      const entry = findCameraEntry(catalogKey, cameraModels);
      const existingCodes = cameraRows.flatMap((r) => [r.camera_code, r.serial_number]);

      const applyLocalCode = (code, modelLabel) => {
        setDetected((prev) => ({
          ...prev,
          camera_code: code,
          serial_number: '',
          serial_is_generated: true,
          brand: entry?.brand || prev.brand,
          model_name: entry?.model || prev.model_name,
          name: entry?.model || prev.name,
          camera_type: entry?.cameraType || prev.camera_type,
          catalog_key: catalogKey,
          note: prev.note || `Mã quầy ${modelLabel || entry?.model || ''}`.trim(),
        }));
        setSerialCheck(null);
      };

      // Mobile-first: sinh mã ngay trên máy, không chờ Mac/server.
      if (isMobileDataEnabled()) {
        if (!entry) {
          reportError('Chưa có model trong catalog — chọn lại hãng/model');
          return;
        }
        applyLocalCode(buildCounterCodeLocal(entry, existingCodes), entry.model);
        return;
      }

      try {
        const { data } = await api.post('/retail/catalog/generate-camera-code', {
          catalog_key: catalogKey,
        });
        setDetected((prev) => ({
          ...prev,
          camera_code: data.camera_code,
          serial_number: '',
          serial_is_generated: true,
          brand: data.brand || prev.brand,
          model_name: data.model || prev.model_name,
          name: data.model || prev.name,
          camera_type: data.camera_type || prev.camera_type,
          catalog_key: data.catalog_key || prev.catalog_key,
          note: data.note || prev.note,
        }));
        setSerialCheck(null);
      } catch (err) {
        if (entry) {
          applyLocalCode(buildCounterCodeLocal(entry, existingCodes), entry.model);
          return;
        }
        reportRequestError(err, 'Sinh mã quầy thất bại');
      }
    },
    [cameraModels, cameraRows, reportError, reportRequestError],
  );

  const handlePrintCounterLabel = () => {
    if (!detected?.camera_code?.trim()) {
      reportError('Chưa có mã quầy — chọn hãng và model trước');
      return;
    }
    const ok = printCameraCounterLabel({
      cameraCode: detected.camera_code,
      brand: detected.brand,
      modelName: detected.model_name || detected.name,
      serialNumber: detected.serial_number,
    });
    if (!ok) reportError('Không mở được cửa sổ in — cho phép popup trên trình duyệt');
  };

  const loadFromStockRow = (row, group) => {
    setActiveGroup(group);
    setActiveStockRowId(row._id);
    setLowConfidenceFields(new Set());
    if (group === 'film') {
      setDetected({
        ...EMPTY,
        product_group: 'film',
        source: 'stock_restock',
        sku_code: row.sku_code,
        barcode: row.barcode || row.sku_code,
        name: row.name,
        brand: row.brand,
        iso: row.iso,
        size: row.size,
        cost: row.cost,
        price: row.price,
        floor_price: row.floor_price,
        quantity: 1,
        expiry_date: row.expiry_date ? String(row.expiry_date).slice(0, 10) : '',
        note: `Bổ sung tồn — hiện ${row.quantity} cuộn cùng SKU`,
      });
      pendingFocusRef.current = 'quantity';
    } else if (group === 'battery') {
      setDetected({
        ...EMPTY,
        product_group: 'battery',
        source: 'stock_restock',
        sku_code: row.sku_code,
        barcode: row.barcode || row.sku_code,
        name: row.name,
        battery_type: row.battery_type,
        cost: row.cost,
        price: row.price,
        floor_price: row.floor_price,
        quantity: 1,
        note: `Bổ sung tồn — hiện ${row.quantity} ${row.battery_type || 'pin'}`,
      });
      pendingFocusRef.current = 'quantity';
    } else {
      const catalogKey = row.catalog_key || '';
      setDetected({
        ...EMPTY,
        product_group: 'camera',
        source: 'stock_template',
        catalog_key: catalogKey,
        model_name: row.model_name,
        name: row.model_name,
        brand: row.brand,
        camera_type: row.camera_type,
        cost: row.cost,
        price: row.price,
        floor_price: row.floor_price,
        condition_note: '',
        has_defect: false,
        defect_tags: [],
        condition_grade: 'A',
        camera_code: '',
        note: `Thêm máy cùng model (${row.camera_code}) — nhập serial mới`,
      });
      if (catalogKey) void generateCounterCode(catalogKey);
      pendingFocusRef.current = 'serial_number';
    }
    requestAnimationFrame(() => {
      formZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const saveProduct = async () => {
    if (!detected?.name?.trim()) {
      const nameHint =
        detected.product_group === 'film'
          ? 'Chọn hãng và cuộn film'
          : detected.product_group === 'camera'
            ? 'Chọn hãng và model'
            : 'Vui lòng nhập tên sản phẩm';
      reportError(nameHint);
      return;
    }
    if (detected.product_group === 'film') {
      if (!detected.catalog_key?.trim()) {
        reportError('Chọn hãng và cuộn film từ master data');
        return;
      }
      if (!detected.sku_code?.trim()) {
        reportError('Film cần mã SKU — chọn lại cuộn film');
        return;
      }
      if (!detected.expiry_date) {
        reportError('Film cần chọn hạn sử dụng');
        return;
      }
    }
    if (detected.product_group === 'battery' && !detected.sku_code?.trim()) {
      reportError('Pin cần mã SKU');
      return;
    }
    if (detected.product_group === 'camera') {
      const hasSerial = Boolean(detected.serial_number?.trim());
      const hasCode = Boolean(detected.camera_code?.trim());
      if (!hasSerial && !hasCode) {
        reportError('Nhập số sê-ri máy hoặc sinh mã quầy');
        return;
      }
    }

    const costNum = Number(detected.cost) || 0;
    setSaving(true);
    reportError('');
    try {
      const payload = {
        product_group: detected.product_group,
        sku_code: detected.sku_code,
        camera_code: detected.camera_code,
        serial_number: detected.serial_number,
        barcode: detected.barcode || scanInput,
        name: detected.name.trim(),
        model_name: detected.model_name || detected.name,
        brand: detected.brand,
        brand_group: detected.brand_group,
        category_cluster: detected.category_cluster,
        battery_type: detected.battery_type || 'OTHER',
        iso: detected.iso,
        size: detected.size,
        cost: costNum,
        price: Number(detected.price) || 0,
        floor_price: costNum,
        quantity: Number(detected.quantity) || 1,
        expiry_date: detected.expiry_date,
        condition_note: detected.condition_note,
        has_defect: detected.has_defect,
        defect_tags: detected.defect_tags || [],
        condition_grade: detected.condition_grade || 'A',
        note: detected.note,
        catalog_key: detected.catalog_key,
        camera_type: detected.camera_type,
        film_type: detected.film_type,
        exposures: detected.exposures,
        color_character: detected.color_character,
        serial_is_generated: detected.serial_is_generated,
        estimated_year: detected.estimated_year,
      };
      const { data } = await confirmIntake(payload);
      if (data?.product_group === 'camera' && data.row?.status && data.row.status !== 'San_Hang') {
        reportSuccess(
          `${data.message} — máy đang "${data.row.status === 'Cho_Sua' ? 'Chờ sửa' : 'Đang sửa'}", chưa hiện ở tab Bán cho đến khi sẵn hàng.`
        );
      } else {
        reportSuccess(data.message);
      }
      setScanInput('');
      resetToManualForm(activeGroup);
      onSaved?.();
    } catch (err) {
      reportRequestError(err, 'Lưu nhập kho thất bại');
    } finally {
      setSaving(false);
    }
  };

  const cameraBrandList = useMemo(
    () => [...new Set(cameraModels.map((c) => c.brand))].sort((a, b) => a.localeCompare(b, 'vi')),
    [cameraModels],
  );

  const cameraBrandPick =
    detected?.brand ||
    (detected?.catalog_key
      ? cameraModels.find((c) => c.catalogKey === detected.catalog_key)?.brand || ''
      : '');

  const cameraModelsForBrand = useMemo(
    () => (cameraBrandPick ? cameraModels.filter((c) => c.brand === cameraBrandPick) : []),
    [cameraModels, cameraBrandPick],
  );

  const cameraBrandOptions = useMemo(
    () => cameraBrandList.map((brand) => ({ value: brand, label: brand })),
    [cameraBrandList],
  );

  const cameraModelOptions = useMemo(
    () =>
      cameraModelsForBrand.map((c) => ({
        value: c.catalogKey,
        label: cameraModelLabel(c),
      })),
    [cameraModelsForBrand],
  );

  const handleCameraBrandChange = (brand) => {
    setSerialCheck(null);
    setDetected((prev) => ({
      ...prev,
      brand,
      catalog_key: '',
      model_name: '',
      name: '',
      camera_type: '',
      serialRange: undefined,
      serialPattern: undefined,
    }));
  };

  const filmBrandList = useMemo(
    () => [...new Set(filmStocks.map((f) => f.brand))].sort((a, b) => a.localeCompare(b, 'vi')),
    [filmStocks],
  );

  const filmBrandPick =
    detected?.product_group === 'film'
      ? detected.brand ||
        (detected.catalog_key
          ? filmStocks.find((f) => f.catalogKey === detected.catalog_key)?.brand || ''
          : '')
      : '';

  const filmStocksForBrand = useMemo(
    () => (filmBrandPick ? filmStocks.filter((f) => f.brand === filmBrandPick) : []),
    [filmStocks, filmBrandPick],
  );

  const filmBrandOptions = useMemo(
    () => filmBrandList.map((brand) => ({ value: brand, label: brand })),
    [filmBrandList],
  );

  const filmStockOptions = useMemo(
    () =>
      filmStocksForBrand.map((f) => ({
        value: f.catalogKey,
        label: `${filmStockLabel(f)} (ISO ${f.iso})`,
      })),
    [filmStocksForBrand],
  );

  const handleFilmBrandChange = (brand) => {
    setFilmFormat('35mm');
    setDetected((prev) => ({
      ...prev,
      brand,
      catalog_key: '',
      name: '',
      sku_code: '',
      iso: '',
      size: '',
      film_type: '',
      exposures: '',
      color_character: '',
      formats: undefined,
      note: '',
    }));
  };

  const detectedFormBlock = detected ? (
    <div className="retail-cart-card retail-intake-card rounded-2xl border border-[var(--color-separator)] bg-[var(--color-bg-elevated)] retail-intake-detected-form">
      <div className="retail-cart-card-head intake-form-head">
        <p className="intake-form-sheet-title">Phiếu nhập</p>
        <RefreshButton onClick={() => resetToManualForm(activeGroup)} />
      </div>
      {lowConfidenceFields.size > 0 && (
        <p className="intake-uncertain-hint retail-intake-card-section">
          AI gợi ý — kiểm tra các ô viền vàng trước khi lưu.
        </p>
      )}

      {detected.product_group === 'film' && filmStocks.length > 0 && (
        <div className="intake-catalog-panel retail-intake-card-section">
          <div className="retail-cart-deal intake-field-deal">
            <LabeledSearchableSelect
              label="Hãng"
              required
              value={filmBrandPick}
              options={filmBrandOptions}
              placeholder="Chọn hoặc gõ hãng"
              onChange={(e) => handleFilmBrandChange(e.target.value)}
            />
            <LabeledSearchableSelect
              label="Cuộn film"
              required
              disabled={!filmBrandPick}
              value={detected.catalog_key || ''}
              options={filmStockOptions}
              placeholder={filmBrandPick ? 'Chọn hoặc gõ cuộn' : 'Chọn hãng trước'}
              onChange={(e) => {
                const key = e.target.value;
                updateField('catalog_key', key);
                if (key) applyFilmCatalog(key);
                else {
                  setDetected((prev) => ({
                    ...prev,
                    name: '',
                    sku_code: '',
                    iso: '',
                    film_type: '',
                    exposures: '',
                    formats: undefined,
                  }));
                }
              }}
            />
          </div>
          {detected.formats?.length > 1 && (
            <LabeledSelect
              label="Khổ film"
              value={filmFormat}
              onChange={(e) => {
                const fmt = e.target.value;
                setFilmFormat(fmt);
                if (detected.catalog_key) applyFilmCatalog(detected.catalog_key, fmt);
              }}
            >
              {detected.formats.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {fmt === '35mm' ? '135 / 35mm' : fmt}
                </option>
              ))}
            </LabeledSelect>
          )}
          {detected.catalog_key && detected.iso && (
            <p className="intake-form-meta">
              ISO {detected.iso}
              {detected.film_type ? ` · ${detected.film_type}` : ''}
              {detected.exposures ? ` · ${detected.exposures}` : ''}
              {detected.size ? ` · Khổ ${detected.size}` : ''}
            </p>
          )}

        </div>
      )}

      {detected.product_group === 'film' && detected.catalog_key && (
        <div className="retail-intake-card-section">
          <LabeledInput
            label="Mã SKU"
            hint="Từ master data — quét FIFO khi bán."
            showCharCount={false}
            readOnly
            placeholder="FLM-KOD-CP200-35"
            value={detected.sku_code || ''}
          />
        </div>
      )}

      {detected.product_group === 'camera' && (
        <div className="intake-catalog-panel retail-intake-card-section">
          <div className="retail-cart-deal intake-field-deal">
            <LabeledSearchableSelect
              label="Hãng"
              required
              value={cameraBrandPick}
              options={cameraBrandOptions}
              placeholder="Chọn hoặc gõ hãng"
              onChange={(e) => handleCameraBrandChange(e.target.value)}
            />
            <LabeledSearchableSelect
              label="Model"
              required
              disabled={!cameraBrandPick}
              value={detected.catalog_key || ''}
              options={cameraModelOptions}
              placeholder={cameraBrandPick ? 'Chọn hoặc gõ model' : 'Chọn hãng trước'}
              onChange={(e) => {
                const key = e.target.value;
                updateField('catalog_key', key);
                if (key) applyCameraCatalog(key);
                else {
                  setDetected((prev) => ({
                    ...prev,
                    model_name: '',
                    name: '',
                    camera_type: '',
                    serialRange: undefined,
                    serialPattern: undefined,
                  }));
                }
              }}
            />
          </div>
          {detected.serialRange && (
            <p className="intake-form-meta">Khoảng sê-ri: {detected.serialRange}</p>
          )}
          {detected.camera_type && (
            <p className="intake-form-meta intake-camera-type-meta">
              Loại máy: {CAMERA_TYPE_LABELS[detected.camera_type] || detected.camera_type}
            </p>
          )}

        </div>
      )}

      {detected.product_group === 'battery' && (
        <div className="retail-cart-deal intake-field-deal retail-intake-card-section">
          <div className="retail-cart-offer-col intake-field-col">
            <LabeledInput
              label="Tên sản phẩm"
              required
              inputClassName={uncertainClass('name', 'font-semibold')}
              placeholder="Tên hiển thị"
              value={detected.name}
              onChange={(e) => updateField('name', e.target.value)}
            />
          </div>
          <div className="retail-cart-outcome-col intake-field-col">
            <LabeledInput
              label="Mã SKU"
              required
              placeholder="BAT-LR44-PK"
              value={detected.sku_code || ''}
              onChange={(e) => updateField('sku_code', e.target.value)}
            />
          </div>
        </div>
      )}

      {detected.product_group === 'camera' && (
        <div className="retail-cart-deal intake-field-deal retail-intake-card-section">
          <div className="retail-cart-offer-col intake-field-col">
            <LabeledInput
              label="Mã quầy"
              showCharCount={false}
              readOnly
              placeholder="Chọn model để sinh mã"
              value={detected.camera_code || ''}
            />
          </div>
          <div className="retail-cart-outcome-col intake-field-col">
            <LabeledInput
              label="Số sê-ri máy"
              showCharCount={false}
              data-intake-focus="serial"
              inputClassName={uncertainClass('serial_number')}
              placeholder="AE1-2100001"
              value={detected.serial_number}
              onChange={(e) => {
                updateField('serial_number', e.target.value);
                if (e.target.value.trim()) {
                  updateField('serial_is_generated', false);
                }
                setSerialCheck(null);
              }}
              onBlur={checkCameraSerial}
            />
            {serialCheck && !serialCheck.valid && (
              <p className="type-footnote mt-1 text-amber-800">{serialCheck.message}</p>
            )}
          </div>
        </div>
      )}

      <PriceFieldsRow
        variant="cart-strip"
        cost={detected.cost}
        price={detected.price}
        onChange={(patch) => setDetected((prev) => ({ ...prev, ...patch }))}
      />

      <div className="intake-field-grid retail-intake-card-section">
        {detected.product_group === 'film' && (
          <>
            <LabeledInput
              label="Số cuộn nhập"
              type="text"
              inputMode="numeric"
              placeholder="VD: 10"
              data-intake-focus="qty"
              inputClassName={uncertainClass('quantity')}
              value={detected.quantity}
              onChange={(e) => updateField('quantity', e.target.value.replace(/\D/g, ''))}
            />
            <LabeledInput
              label="Hạn dùng"
              required
              type="date"
              value={detected.expiry_date}
              onChange={(e) => updateField('expiry_date', e.target.value)}
            />
          </>
        )}
        {detected.product_group === 'battery' && (
          <div className="col-span-2">
            <LabeledInput
              label="Số lượng nhập"
              type="text"
              inputMode="numeric"
              placeholder="VD: 20"
              data-intake-focus="qty"
              inputClassName={uncertainClass('quantity')}
              value={detected.quantity}
              onChange={(e) => updateField('quantity', e.target.value.replace(/\D/g, ''))}
            />
          </div>
        )}
        {detected.product_group === 'camera' && (
          <div className="col-span-2 space-y-3">
            <CameraConditionFields
              value={detected}
              onChange={(next) => setDetected((d) => ({ ...d, ...next }))}
            />
            <LabeledTextarea
              label="Tình trạng"
              rows={2}
              placeholder="Mới 95%, lens sạch..."
              value={detected.condition_note}
              onChange={(e) => updateField('condition_note', e.target.value)}
            />
          </div>
        )}
      </div>

      <div
        className={`intake-form-actions retail-intake-card-actions ${
          detected.product_group === 'camera' ? 'intake-form-actions--dual' : 'intake-form-actions--single'
        }`}
      >
        {detected.product_group === 'camera' && (
          <button
            type="button"
            onClick={handlePrintCounterLabel}
            disabled={!detected.camera_code?.trim()}
            className="apple-btn-secondary btn-pill--block"
          >
            In
          </button>
        )}
        <button
          type="button"
          onClick={saveProduct}
          disabled={saving}
          className="apple-btn-primary btn-pill--block"
        >
          {saving ? 'Đang lưu...' : 'Duyệt nhập kho'}
        </button>
      </div>
    </div>
  ) : null;

  const groupPickerBlock = (
    <section className="retail-intake-group-section">
      <p className="retail-manual-section-title">Danh mục kho</p>
      <div className="retail-group-picker">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => selectGroup(g.id)}
            className={`retail-group-btn ${activeGroup === g.id ? 'retail-group-btn-active' : ''}`}
          >
            <p className="font-semibold retail-group-btn-title">{g.label}</p>
            <p className="retail-group-btn-desc">{g.desc}</p>
          </button>
        ))}
      </div>
    </section>
  );

  const entryClusterBlock = (
    <section className="intake-entry-cluster" aria-label="Thêm hàng">
      <ProductScanSearchRow
        hideLabel
        hideLeadingIcon
        ariaLabel="Quét hoặc nhập mã"
        value={scanInput}
        onChange={(e) => setScanInput(e.target.value)}
        onSubmit={handleBarcodeScan}
        onOpenCamera={() => setShowCamera(true)}
        loading={aiLoading}
        note="Gõ mã, quét camera hoặc chọn ảnh trong màn quét"
      />
    </section>
  );

  const stockListBlock = (
    <section className="retail-intake-stock-section" aria-label="Tồn kho">
      <div className="retail-intake-stock-panel">
        <div className="retail-intake-stock-panel-head">
          <p className="retail-intake-stock-panel-title">Tồn kho — chạm để bổ sung</p>
        </div>
        <IntakeStockList
          group={activeGroup}
          filmRows={filmRows}
          batteryRows={batteryRows}
          cameraRows={cameraRows}
          activeRowId={activeStockRowId}
          onSelectRow={loadFromStockRow}
          onSeedTestCameras={activeGroup === 'camera' ? onSeedTestCameras : undefined}
          onOpenCameraDetail={(cam) => {
            setDetailCameraId(cam._id);
            setDetailOpen(true);
          }}
        />
      </div>
    </section>
  );

  const intakeContentBlock = aiLoading ? (
    <div className="retail-intake-loading">
      <IconLoading size={ICON_SIZE.loadingLg} />
      <p>AI đang tra cứu kho / phân tích ảnh...</p>
    </div>
  ) : (
    detectedFormBlock
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

      {/* Mobile xếp dọc; desktop md+: Danh mục kho trái — phiếu/quét phải */}
      <div className="retail-pos-mobile retail-intake-mobile">
        {panelError && (
          <p className="retail-intake-error" role="alert">
            {panelError}
          </p>
        )}

        <div className="retail-intake-layout">
          <aside className="retail-intake-layout__aside">{groupPickerBlock}</aside>

          <div className="retail-intake-layout__main">
            {entryClusterBlock}

            <section
              ref={formZoneRef}
              className="retail-pos-cart retail-intake-form-zone"
              aria-label="Phiếu nhập"
            >
              {intakeContentBlock}
            </section>

            {stockListBlock}
          </div>
        </div>
      </div>

      {showCamera && (
        <Modal title="Quét mã vạch / QR" onClose={closeCameraModal}>
          <div className="intake-scan-modal">
            <video
              ref={videoRef}
              className="intake-scan-modal__video"
              playsInline
              muted
            />
            <p className="intake-scan-modal__hint">
              {cameraHint || 'Đưa mã vạch vào khung hình...'}
            </p>
            <div className="intake-scan-modal__or" aria-hidden="true">
              <span>hoặc</span>
            </div>
            <button
              type="button"
              className="intake-scan-modal__gallery"
              onClick={openGalleryForVision}
              disabled={aiLoading}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                photo_library
              </span>
              <span>
                <strong>Chọn ảnh từ thư viện</strong>
                <small>AI nhận diện sản phẩm</small>
              </span>
            </button>
          </div>
        </Modal>
      )}

      <CameraDetailModal
        cameraId={detailCameraId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onUpdated={onSaved}
      />
    </>
  );
}
