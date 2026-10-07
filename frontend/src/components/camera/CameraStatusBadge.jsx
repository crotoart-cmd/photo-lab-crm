import { STATUS_BADGE, STATUS_LABELS } from '../../constants/cameraLifecycle';

export default function CameraStatusBadge({ status, className = '' }) {
  if (!status) return null;
  const cls = STATUS_BADGE[status] || 'camera-badge-muted';
  return (
    <span className={`camera-badge ${cls} ${className}`.trim()}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
