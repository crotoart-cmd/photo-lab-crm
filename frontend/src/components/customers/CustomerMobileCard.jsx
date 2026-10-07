import CustomerTagPill, { LtvBadge } from './CustomerTagPill';
import SymbolNew from '../icons/SymbolNew';
import { IconDetail, IconSeeMore, IconEdit, IconDelete } from '../icons/tabBarIcons';
import { ICON_SIZE } from '../icons/iconSizes';
import { customerInitials, fullName } from '../../utils/customerNormalize';

export default function CustomerMobileCard({ customer, onProfile, onEdit, onDelete }) {
  const name = fullName(customer);
  const initials = customerInitials(customer);
  const tags = customer.tags || [];
  const newTag = tags.find((tag) => tag.id === 'new');
  const displayTags = tags.filter((tag) => tag.id !== 'new');
  const lastVisit = customer.stats?.lastVisit
    ? new Date(customer.stats.lastVisit).toLocaleDateString('vi-VN')
    : null;

  return (
    <article className="customer-mobile-card">
      <div className="customer-mobile-card__body">
        <div className="customer-mobile-card__header">
          <div className="customer-mobile-card__avatar" aria-hidden>
            {initials}
            {newTag ? (
              <span className="customer-mobile-card__new-badge">
                <SymbolNew height={15} title={newTag.label} />
              </span>
            ) : null}
            <span className="customer-mobile-card__ltv">
              <LtvBadge grade={customer.ltvGrade} />
            </span>
          </div>

          <div className="customer-mobile-card__main min-w-0 flex-1">
            <p className="customer-mobile-card__name">{name}</p>
            <p className="customer-mobile-card__meta">
              {customer.customerCode && (
                <span className="customer-mobile-card__code">{customer.customerCode}</span>
              )}
              {customer.customerCode && customer.phone ? (
                <span className="customer-mobile-card__dot" aria-hidden>
                  ·
                </span>
              ) : null}
              {customer.phone ? <span className="customer-mobile-card__phone">{customer.phone}</span> : null}
            </p>
            {customer.email ? (
              <p className="customer-mobile-card__email">{customer.email}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onProfile(customer)}
            className="customer-mobile-card__profile"
            aria-label={`Chi tiết — ${name}`}
          >
            <IconDetail className="customer-mobile-card__profile-icon" size={ICON_SIZE.nav} />
            <span>Chi tiết</span>
          </button>
        </div>

        {(displayTags.length > 0 || lastVisit) && (
          <div className="customer-mobile-card__tags">
            {displayTags.slice(0, 4).map((tag) => (
              <CustomerTagPill key={tag.id} tag={tag} />
            ))}
            {displayTags.length > 4 ? (
              <span className="customer-mobile-card__more-tags">
                <IconSeeMore size={14} />
                Xem thêm
              </span>
            ) : null}
            {lastVisit ? (
              <span className="customer-mobile-card__visit">Ghé {lastVisit}</span>
            ) : null}
          </div>
        )}
      </div>

      <div className="customer-mobile-card__actions">
        <button
          type="button"
          onClick={() => onDelete(customer._id)}
          className="customer-mobile-card__action customer-mobile-card__action--danger"
        >
          <IconDelete />
          <span>Xóa</span>
        </button>
        <button type="button" onClick={() => onEdit(customer)} className="customer-mobile-card__action">
          <IconEdit />
          <span>Sửa</span>
        </button>
      </div>
    </article>
  );
}
