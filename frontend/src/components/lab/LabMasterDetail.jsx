export function LabMobileBack({ onClick, children = '← Quay lại danh sách' }) {
  return (
    <button type="button" className="lab-mobile-back" onClick={onClick}>
      {children}
    </button>
  );
}

export function LabDetailEmpty({ children }) {
  return <div className="lab-detail-empty">{children}</div>;
}

export function LabRowMark({ children }) {
  return (
    <span className="lab-row-mark" aria-hidden="true">
      {children}
    </span>
  );
}

export default function LabMasterDetail({
  toolbar,
  list,
  detail,
  footer,
  listHidden = false,
  detailHidden = false,
  onBack,
  backLabel,
  selected = false,
  className = '',
}) {
  return (
    <div className={`lab-desk${selected ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      {toolbar ? <div className="lab-desk__toolbar">{toolbar}</div> : null}
      <div className="lab-desk__workspace">
        <div className={`lab-desk__master${listHidden ? ' max-lg:hidden' : ''}`}>{list}</div>
        <div className={`lab-desk__detail${detailHidden ? ' max-lg:hidden' : ''}`}>
          {onBack && !detailHidden ? <LabMobileBack onClick={onBack}>{backLabel}</LabMobileBack> : null}
          {detail}
        </div>
      </div>
      {footer ? <div className="lab-desk__footer">{footer}</div> : null}
    </div>
  );
}
