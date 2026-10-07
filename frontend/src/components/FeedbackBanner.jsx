/**
 * Inline feedback — Apple HIG “Feedback” (success / error / info).
 * Dùng sau hành động (lưu, gửi email, upload) thay vì chỉ alert().
 */
export default function FeedbackBanner({ variant = 'info', children, onDismiss }) {
  const classMap = {
    success: 'apple-alert-success',
    error: 'apple-alert-error',
    info: 'apple-alert-info',
  };
  const cls = classMap[variant] || classMap.info;

  return (
    <div className={`${cls} flex items-start gap-2 justify-between`} role="status">
      <div className="flex-1 min-w-0">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="apple-btn-ghost !py-1 !px-2 shrink-0"
          aria-label="Đóng thông báo"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      ) : null}
    </div>
  );
}
