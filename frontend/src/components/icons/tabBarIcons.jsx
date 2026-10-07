import IconOverview from './IconOverview';
import IconDetail from './IconDetail';
import IconSeeMore from './IconSeeMore';
import IconIntake from './IconIntake';
import IconSale from './IconSale';
import IconQR from './IconQR';
import IconPersonAdd from './IconPersonAdd';
import IconEdit from './IconEdit';
import IconDelete from './IconDelete';
import IconFilter from './IconFilter';
import IconScan from './IconScan';
import IconLocation from './IconLocation';
import IconContact from './IconContact';
import IconLoading from './IconLoading';
import IconChevron from './IconChevron';
import Icon32 from './Icon32';

export const TAB_BAR_CUSTOM_ICONS = {
  overview: IconOverview,
  intake: IconIntake,
  sale: IconSale,
};

/** Sidebar / drawer — mở rộng tab icons + khách hàng */
export const NAV_CUSTOM_ICONS = {
  ...TAB_BAR_CUSTOM_ICONS,
  customer: IconPersonAdd,
};

export {
  Icon32,
  IconOverview,
  IconDetail,
  IconSeeMore,
  IconIntake,
  IconSale,
  IconQR,
  IconPersonAdd,
  IconEdit,
  IconDelete,
  IconFilter,
  IconScan,
  IconLocation,
  IconContact,
  IconLoading,
  IconChevron,
};
export { default as SymbolNew } from './SymbolNew';
