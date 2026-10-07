import { ICON_SIZE } from './iconSizes';
import IconScan from './IconScan';
import IconQR from './IconQR';

/** Nút tròn 40px cạnh ô tìm — scan sản phẩm */
export function ProductScanIcon(props) {
  return <IconScan size={ICON_SIZE.rowAction} framed {...props} />;
}

/** Nút tròn 40px cạnh ô tìm — quét QR khách */
export function CustomerQrIcon(props) {
  return <IconQR size={ICON_SIZE.rowAction} framed {...props} />;
}
