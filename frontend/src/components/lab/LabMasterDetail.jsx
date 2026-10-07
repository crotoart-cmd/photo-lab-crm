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

export default function LabMasterDetail({
  list,
  detail,
  listHidden = false,
  detailHidden = false,
  onBack,
  backLabel,
}) {
  return (
    <div className="lab-master-detail">
      <div className={listHidden ? 'max-lg:hidden' : ''}>{list}</div>
      <div className={detailHidden ? 'max-lg:hidden' : ''}>
        {onBack && !detailHidden && <LabMobileBack onClick={onBack}>{backLabel}</LabMobileBack>}
        {detail}
      </div>
    </div>
  );
}
