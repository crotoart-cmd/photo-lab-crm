import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import AppleSegmentedControl from '../components/AppleSegmentedControl';
import LabPageShell from '../components/lab/LabPageShell';
import {
  LabeledInput,
  LabeledSelect,
} from '../components/formFields';
import {
  loadInventoryBridge,
  upsertInventoryBridge,
  adjustInventoryBridge,
  applyNaturalLossBridge,
  INVENTORY_DATA_CHANGED,
} from '../lib/mobileInventoryBridge';

const CATEGORIES = [
  { value: '', label: 'Tất cả' },
  { value: 'chemical', label: 'Hóa chất/Thuốc tráng' },
  { value: 'film', label: 'Cuộn film' },
  { value: 'camera', label: 'Máy ảnh & phụ kiện' },
  { value: 'supplies', label: 'Vật tư khác' },
];

const emptyForm = {
  itemName: '',
  category: 'chemical',
  quantity: 0,
  unit: 'ml',
  minStock: 1000,
  maxStock: 10000,
  naturalLossPercent: 0,
  maxRollCapacity: '',
  lotCode: '',
  expiryDate: '',
  filmFormat: '',
  iso: '',
  filmType: '',
  serialNumber: '',
  cameraCondition: '',
  consumptionRecipe: [{ processCode: 'c41', filmFormat: '35mm', mlPerRoll: 250 }],
  price: '',
  supplier: '',
  notes: '',
};

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState({ lowStockCount: 0, overCapacityCount: 0 });
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [adjustId, setAdjustId] = useState(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustMode, setAdjustMode] = useState('restock');
  const [adjustReason, setAdjustReason] = useState('');
  const [naturalLossPercent, setNaturalLossPercent] = useState(1);

  const load = () => {
    const params = {};
    if (lowStockOnly) params.lowStock = 'true';
    if (categoryFilter) params.category = categoryFilter;
    return loadInventoryBridge(params).then(({ items: nextItems, logs: nextLogs, alerts: nextAlerts }) => {
      setItems(nextItems);
      setLogs(nextLogs);
      setAlerts(nextAlerts);
    });
  };

  useEffect(() => {
    load().catch(() => {});
  }, [lowStockOnly, categoryFilter]);

  useEffect(() => {
    const onChanged = () => {
      load().catch(() => {});
    };
    window.addEventListener(INVENTORY_DATA_CHANGED, onChanged);
    return () => window.removeEventListener(INVENTORY_DATA_CHANGED, onChanged);
  }, [lowStockOnly, categoryFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setForm({
      itemName: item.itemName,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      minStock: item.minStock,
      maxStock: item.maxStock,
      naturalLossPercent: item.naturalLossPercent || 0,
      maxRollCapacity: item.maxRollCapacity || '',
      lotCode: item.lotCode || '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      filmFormat: item.filmFormat || '',
      iso: item.iso || '',
      filmType: item.filmType || '',
      serialNumber: item.serialNumber || '',
      cameraCondition: item.cameraCondition || '',
      consumptionRecipe:
        item.consumptionRecipe?.length > 0
          ? item.consumptionRecipe.map((recipe) => ({
              processCode: recipe.processCode || 'c41',
              filmFormat: recipe.filmFormat || '35mm',
              mlPerRoll: recipe.mlPerRoll || 0,
            }))
          : [{ processCode: 'c41', filmFormat: '35mm', mlPerRoll: 250 }],
      price: item.price || '',
      supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setEditingId(item._id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      quantity: Number(form.quantity || 0),
      minStock: Number(form.minStock || 0),
      maxStock: Number(form.maxStock || 0),
      naturalLossPercent: Number(form.naturalLossPercent || 0),
      maxRollCapacity: form.maxRollCapacity ? Number(form.maxRollCapacity) : undefined,
      iso: form.iso ? Number(form.iso) : undefined,
      price: form.price ? Number(form.price) : undefined,
      consumptionRecipe:
        form.category === 'chemical'
          ? form.consumptionRecipe
              .filter((recipe) => Number(recipe.mlPerRoll) > 0)
              .map((recipe) => ({ ...recipe, mlPerRoll: Number(recipe.mlPerRoll) }))
          : [],
    };

    await upsertInventoryBridge(payload, editingId);
    setShowModal(false);
    load();
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    await adjustInventoryBridge(adjustId, {
      quantity: Number(adjustQty),
      restock: adjustMode === 'restock',
      actionType: adjustMode === 'restock' ? 'import' : 'adjustment',
      reason: adjustReason || (adjustMode === 'restock' ? 'Nhập kho bổ sung' : 'Cân bằng kho cuối tuần'),
    });
    setAdjustId(null);
    setAdjustReason('');
    setAdjustMode('restock');
    load();
  };

  const handleNaturalLoss = async () => {
    await applyNaturalLossBridge({
      percent: Number(naturalLossPercent),
      reason: `Hao hụt tự nhiên ${naturalLossPercent}%`,
    });
    load();
  };

  const isLow = (item) => {
    const quantity = item.category === 'chemical' ? Number(item.quantityMl || 0) : Number(item.quantity || 0);
    return quantity <= Number(item.minStock || 0);
  };

  const displayQuantity = (item) =>
    item.category === 'chemical' ? `${item.quantityMl || 0} ml` : `${item.quantity} ${item.unit}`;

  const categoryLabel = (value) =>
    CATEGORIES.find((c) => c.value === value)?.label || value;

  return (
    <LabPageShell>
      <PageHeader title="Thuốc Tráng">
        <button
          type="button"
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`apple-btn-secondary text-sm ${lowStockOnly ? '!border-[var(--color-red)] !text-[var(--color-red)]' : ''}`}
        >
          {lowStockOnly ? 'Đang lọc: Sắp hết' : 'Lọc sắp hết'}
        </button>
        <button type="button" onClick={openCreate} className="apple-btn-primary text-sm">
          + Thêm hàng
        </button>
      </PageHeader>

      <Link to="/retail?tab=intake" className="lab-link-muted mb-4">
        → Nhập hàng (AI & thủ công)
      </Link>

      <AppleSegmentedControl
        className="mb-4"
        items={CATEGORIES}
        value={categoryFilter}
        onChange={setCategoryFilter}
      />

      {(alerts.lowStockCount > 0 || alerts.overCapacityCount > 0) && (
        <div className="lab-alert">
          <p className="lab-alert__title">Sắp hết hàng</p>
          <p className="lab-alert__text">
            {alerts.lowStockCount} mặt hàng chạm ngưỡng tối thiểu và{' '}
            {alerts.overCapacityCount || 0} hóa chất vượt ngưỡng số cuộn tối đa.
          </p>
        </div>
      )}

      <div className="lab-tool-card">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="w-36">
            <LabeledInput
              label="Hao hụt tự nhiên (%)"
              type="number"
              min={0}
              step={0.1}
              value={naturalLossPercent}
              onChange={(e) => setNaturalLossPercent(e.target.value)}
              placeholder="VD: 2"
            />
          </div>
          <button type="button" onClick={handleNaturalLoss} className="apple-btn-secondary text-sm">
            Áp hao hụt tự nhiên
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {items.length === 0 && (
          <p className="text-sm text-center text-[var(--color-label-secondary)] p-6 apple-card">
            Chưa có hàng tồn
          </p>
        )}
        {items.map((item) => (
          <div
            key={item._id}
            className={`apple-card p-4 ${isLow(item) ? 'lab-stock-card--low' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-label)]">{item.itemName}</p>
                <p className="text-xs text-[var(--color-label-secondary)] mt-0.5">
                  {categoryLabel(item.category)}
                </p>
              </div>
              <p className="text-sm font-medium text-[var(--color-label)] shrink-0">
                {displayQuantity(item)}
              </p>
            </div>
            <p className="text-xs text-[var(--color-label-tertiary)] mt-2">
              Min {item.minStock} {item.category === 'chemical' ? 'ml' : item.unit}
              {item.expiryDate
                ? ` · HSD ${new Date(item.expiryDate).toLocaleDateString('vi-VN')}`
                : item.serialNumber
                  ? ` · ${item.serialNumber}`
                  : ''}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" onClick={() => openEdit(item)} className="apple-btn-ghost !py-1 text-xs">
                Sửa
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustId(item._id);
                  setAdjustMode('restock');
                  setAdjustQty(item.category === 'chemical' ? 500 : 1);
                }}
                className="apple-btn-secondary !py-1 text-xs"
              >
                Nhập kho
              </button>
            </div>
          </div>
        ))}
      </div>


      {showModal && (
        <Modal title={editingId ? 'Sửa hàng tồn' : 'Thêm hàng tồn'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <LabeledInput
              label="Tên hàng"
              required
              placeholder="VD: Developer C-41"
              value={form.itemName}
              onChange={(e) => setForm({ ...form, itemName: e.target.value })}
            />
            <LabeledSelect
              label="Loại hàng"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.filter((c) => c.value).map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </LabeledSelect>
            <div className="grid grid-cols-3 gap-3">
              <LabeledInput
                label="Số lượng"
                type="number"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
              <LabeledInput
                label="Đơn vị"
                placeholder="ml, cuộn..."
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
              <LabeledInput
                label="Tồn tối thiểu"
                type="number"
                placeholder="1000"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </div>
            {(form.category === 'film' || form.category === 'chemical') && (
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput
                  label="Mã lô"
                  placeholder="LOT-2026-01"
                  value={form.lotCode}
                  onChange={(e) => setForm({ ...form, lotCode: e.target.value })}
                />
                <LabeledInput
                  label="Hạn dùng"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                />
              </div>
            )}
            {form.category === 'camera' && (
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput
                  label="Serial"
                  placeholder="SN123456"
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                />
                <LabeledInput
                  label="Tình trạng"
                  placeholder="Mới 90%..."
                  value={form.cameraCondition}
                  onChange={(e) => setForm({ ...form, cameraCondition: e.target.value })}
                />
              </div>
            )}
            {form.category === 'chemical' && (
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput
                  label="Hao hụt tự nhiên (%)"
                  type="number"
                  placeholder="5"
                  value={form.naturalLossPercent}
                  onChange={(e) => setForm({ ...form, naturalLossPercent: e.target.value })}
                />
                <LabeledInput
                  label="Số cuộn tối đa"
                  type="number"
                  placeholder="50"
                  value={form.maxRollCapacity}
                  onChange={(e) => setForm({ ...form, maxRollCapacity: e.target.value })}
                />
                <LabeledInput
                  label="Recipe quy trình"
                  placeholder="c41"
                  value={form.consumptionRecipe?.[0]?.processCode || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      consumptionRecipe: [
                        { ...(form.consumptionRecipe?.[0] || {}), processCode: e.target.value || 'c41' },
                      ],
                    })
                  }
                />
                <LabeledInput
                  label="Recipe khổ film"
                  placeholder="35mm"
                  value={form.consumptionRecipe?.[0]?.filmFormat || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      consumptionRecipe: [
                        { ...(form.consumptionRecipe?.[0] || {}), filmFormat: e.target.value || '35mm' },
                      ],
                    })
                  }
                />
                <LabeledInput
                  label="Recipe ml/cuộn"
                  type="number"
                  placeholder="250"
                  value={form.consumptionRecipe?.[0]?.mlPerRoll || 0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      consumptionRecipe: [
                        { ...(form.consumptionRecipe?.[0] || {}), mlPerRoll: Number(e.target.value || 0) },
                      ],
                    })
                  }
                />
              </div>
            )}
            <LabeledInput
              label="Nhà cung cấp"
              placeholder="Tên NCC"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
            <button type="submit" className="apple-btn-primary w-full">
              Lưu
            </button>
          </form>
        </Modal>
      )}

      {adjustId && (
        <Modal title="Nhập kho / Cân bằng kho" onClose={() => setAdjustId(null)}>
          <form onSubmit={handleAdjust} className="space-y-3">
            <LabeledSelect
              label="Loại thao tác"
              value={adjustMode}
              onChange={(e) => setAdjustMode(e.target.value)}
            >
              <option value="restock">Nhập kho</option>
              <option value="adjust">Cân bằng kho</option>
            </LabeledSelect>
            <LabeledInput
              label={adjustMode === 'restock' ? 'Số lượng nhập thêm' : 'Số lượng sau kiểm kê'}
              required
              type="number"
              placeholder="0"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
            />
            <LabeledInput
              label="Lý do thay đổi"
              placeholder="Kiểm kê, nhập hàng mới..."
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
            />
            <button type="submit" className="apple-btn-primary w-full">
              Cập nhật
            </button>
          </form>
        </Modal>
      )}

      <div className="lab-log-section">
        <div className="lab-log-section__head">Lịch sử biến động vật tư</div>
        <ul className="divide-y divide-[var(--color-separator)]">
          {logs.map((log) => (
            <li key={log._id} className="px-4 py-3">
              <p className="text-sm font-medium text-[var(--color-label)]">{log.itemName}</p>
              <p className="text-xs text-[var(--color-label-secondary)] mt-1">
                {new Date(log.createdAt).toLocaleString('vi-VN')} · {log.reason}
              </p>
              <p
                className={`text-sm font-semibold mt-1 ${
                  log.quantityChange < 0 ? 'text-[var(--color-red)]' : 'text-[var(--color-green)]'
                }`}
              >
                {log.quantityChange > 0 ? '+' : ''}
                {log.quantityChange} {log.unit}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </LabPageShell>
  );
}
