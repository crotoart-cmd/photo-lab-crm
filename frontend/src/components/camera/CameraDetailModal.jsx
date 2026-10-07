import { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import { apiErrorMessage } from '../../utils/apiError';
import Modal from '../Modal';
import CameraStatusBadge from './CameraStatusBadge';
import { defectTagLabel, computeTrueCost, formatVnd } from '../../constants/cameraLifecycle';
import { LabeledInput, LabeledTextarea } from '../formFields';

const TIMELINE_LABEL = {
  intake: 'Nhập kho',
  repair: 'Sửa chữa',
  status: 'Trạng thái',
  sale: 'Bán hàng',
  note: 'Ghi chú',
};

export default function CameraDetailModal({ cameraId, open, onClose, onUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [repairForm, setRepairForm] = useState({
    description: '',
    vendor: '',
    parts_cost: '',
    labor_cost: '',
    after_note: '',
    mark_ready: true,
  });

  const load = useCallback(async () => {
    if (!cameraId) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/retail/camera-stock/${cameraId}/profile`);
      setProfile(data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không tải được hồ sơ máy'));
    } finally {
      setLoading(false);
    }
  }, [cameraId]);

  useEffect(() => {
    if (open && cameraId) {
      setTab('overview');
      load();
    }
  }, [open, cameraId, load]);

  const cam = profile?.camera;
  const trueCost = cam ? computeTrueCost(cam) : 0;

  const submitRepair = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/retail/camera-stock/${cameraId}/repairs`, {
        description: repairForm.description,
        vendor: repairForm.vendor,
        parts_cost: Number(repairForm.parts_cost) || 0,
        labor_cost: Number(repairForm.labor_cost) || 0,
        after_note: repairForm.after_note,
        resolved_tags: cam?.defect_tags || [],
        mark_ready: repairForm.mark_ready,
      });
      setProfile({ camera: data.camera, repairs: [data.repair, ...(profile?.repairs || [])] });
      setRepairForm({
        description: '',
        vendor: '',
        parts_cost: '',
        labor_cost: '',
        after_note: '',
        mark_ready: true,
      });
      setTab('repairs');
      onUpdated?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Lưu phiếu sửa thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/retail/camera-stock/${cameraId}/status`, { status });
      setProfile((p) => ({ ...p, camera: data.row }));
      onUpdated?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Cập nhật trạng thái thất bại'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal title={cam ? cam.model_name : 'Hồ sơ máy ảnh'} onClose={onClose} wide>
      {loading && (
        <p className="text-sm text-[var(--color-label-secondary)] py-6 text-center">Đang tải…</p>
      )}
      {error && (
        <p className="text-sm text-[var(--color-red)] mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {cam && !loading && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <CameraStatusBadge status={cam.status} />
            <span className="text-xs font-mono text-[var(--color-label-secondary)]">{cam.camera_code}</span>
            <span className="text-xs text-[var(--color-label-tertiary)]">{cam.serial_number}</span>
          </div>

          <div className="inline-flex gap-1 p-1 mb-4 rounded-full border border-[var(--color-separator)] bg-[var(--color-bg-secondary)]">
            {[
              { id: 'overview', label: 'Tổng quan' },
              { id: 'repairs', label: 'Phiếu sửa' },
              { id: 'timeline', label: 'Lịch sử' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  tab === t.id
                    ? 'bg-white text-[var(--color-label)] shadow-sm'
                    : 'text-[var(--color-label-secondary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="camera-cost-row">
                <div>
                  <p>Giá mua</p>
                  <strong>{formatVnd(cam.cost)}</strong>
                </div>
                <div>
                  <p>Tiền sửa</p>
                  <strong>{formatVnd(cam.total_repair_cost)}</strong>
                </div>
                <div>
                  <p>Vốn thực</p>
                  <strong className="text-[var(--color-blue)]">{formatVnd(trueCost)}</strong>
                </div>
              </div>

              {cam.condition_note && (
                <p className="text-sm text-[var(--color-label-secondary)]">{cam.condition_note}</p>
              )}

              {(cam.defect_tags?.length || 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {cam.defect_tags.map((tag) => (
                    <span key={tag} className="camera-defect-tag camera-defect-tag-active">
                      {defectTagLabel(tag)}
                    </span>
                  ))}
                </div>
              )}

              {cam.status !== 'Da_Ban' && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {cam.status === 'Cho_Sua' && (
                    <button
                      type="button"
                      disabled={saving}
                      className="apple-btn-secondary text-sm"
                      onClick={() => setStatus('Dang_Sua')}
                    >
                      Chuyển đang sửa
                    </button>
                  )}
                  {(cam.status === 'Cho_Sua' || cam.status === 'Dang_Sua') && (
                    <button
                      type="button"
                      disabled={saving}
                      className="apple-btn-primary text-sm"
                      onClick={() => setStatus('San_Hang')}
                    >
                      Sẵn hàng
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'repairs' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <form onSubmit={submitRepair} className="space-y-3 apple-card p-4">
                <p className="text-sm font-semibold text-[var(--color-label)]">Thêm phiếu sửa</p>
                <LabeledTextarea
                  label="Công việc"
                  value={repairForm.description}
                  onChange={(e) => setRepairForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  required
                />
                <LabeledInput
                  label="Thợ / xưởng"
                  value={repairForm.vendor}
                  onChange={(e) => setRepairForm((f) => ({ ...f, vendor: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <LabeledInput
                    label="Linh kiện (đ)"
                    type="number"
                    value={repairForm.parts_cost}
                    onChange={(e) => setRepairForm((f) => ({ ...f, parts_cost: e.target.value }))}
                  />
                  <LabeledInput
                    label="Nhân công (đ)"
                    type="number"
                    value={repairForm.labor_cost}
                    onChange={(e) => setRepairForm((f) => ({ ...f, labor_cost: e.target.value }))}
                  />
                </div>
                <LabeledTextarea
                  label="Tình trạng sau sửa"
                  value={repairForm.after_note}
                  onChange={(e) => setRepairForm((f) => ({ ...f, after_note: e.target.value }))}
                  rows={2}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={repairForm.mark_ready}
                    onChange={(e) => setRepairForm((f) => ({ ...f, mark_ready: e.target.checked }))}
                  />
                  Chuyển sẵn hàng sau khi lưu
                </label>
                <button type="submit" disabled={saving} className="apple-btn-primary w-full">
                  {saving ? 'Đang lưu…' : 'Lưu phiếu sửa'}
                </button>
              </form>

              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {(profile.repairs || []).length === 0 && (
                  <p className="text-sm text-[var(--color-label-secondary)]">Chưa có phiếu sửa.</p>
                )}
                {(profile.repairs || []).map((r) => (
                  <li key={r._id} className="apple-card p-3 text-sm">
                    <p className="font-medium">{r.description}</p>
                    <p className="text-xs text-[var(--color-label-secondary)] mt-1">
                      {new Date(r.date).toLocaleDateString('vi-VN')}
                      {r.vendor ? ` · ${r.vendor}` : ''}
                    </p>
                    <p className="text-xs font-semibold text-[var(--color-blue)] mt-1">
                      {formatVnd(r.total_cost)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'timeline' && (
            <ul className="camera-timeline max-h-96 overflow-y-auto">
              {(cam.timeline || []).length === 0 && (
                <li className="text-sm text-[var(--color-label-secondary)] border-none pl-0">
                  Chưa có lịch sử.
                </li>
              )}
              {(cam.timeline || []).map((ev, i) => (
                <li key={`${ev.at}-${i}`}>
                  <p className="camera-timeline-type">{TIMELINE_LABEL[ev.type] || ev.type}</p>
                  <p className="text-sm text-[var(--color-label)]">{ev.summary}</p>
                  <p className="text-[10px] text-[var(--color-label-tertiary)] mt-0.5">
                    {new Date(ev.at).toLocaleString('vi-VN')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
