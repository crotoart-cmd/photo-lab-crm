import BrandLogo from '../components/BrandLogo';
import { BRAND_NAME, BRAND_TAGLINE } from '../config/brand';

export default function PublicHome() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="text-center max-w-[420px]">
        <div className="flex flex-col items-center mb-6">
          <BrandLogo size="lg" className="items-center mb-3" />
          <h1 className="apple-page-title text-[24px]">{BRAND_NAME}</h1>
          <p className="apple-page-subtitle mt-1">{BRAND_TAGLINE}</p>
        </div>
        <p className="text-[15px] text-[var(--color-label-secondary)] leading-relaxed">
          Lab phim · bảo quản kỷ niệm. Khách nhận ảnh và xác nhận sửa chữa qua đường dẫn riêng.
        </p>
      </div>
    </div>
  );
}
