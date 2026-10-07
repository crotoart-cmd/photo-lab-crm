# Nền tảng UI — Apple Human Interface Guidelines

Tham chiếu chính thức: [Apple Design Resources](https://developer.apple.com/design/resources/)

> Apple **không** dùng Material Design (Google). CRM này áp dụng **HIG** + token web tương đương SF Pro / system colors / glass.

## Đã áp dụng trong repo

| Thành phần | File |
|------------|------|
| Design tokens (màu, radius, glass, typography) | `frontend/src/styles/apple-design.css` |
| Tailwind (`lab` → system blue, font SF) | `frontend/tailwind.config.js` |
| Form controls | `frontend/src/components/formFields.jsx` |
| Shell (sidebar glass, nav) | `frontend/src/components/Layout.jsx` |
| Login, Modal, StatCard, PageHeader | `frontend/src/components/` |
| Dashboard mẫu | `frontend/src/pages/Dashboard.jsx` |

## Class tiện ích

- `apple-glass` — sidebar / sheet kiểu vibrancy
- `apple-card` — card nền elevated
- `apple-btn-primary` / `apple-btn-secondary` / `apple-btn-ghost`
- `apple-page-title` / `apple-page-subtitle`
- `apple-nav-item` / `apple-nav-item-active`
- `apple-alert-error` / `apple-alert-success`

## Mở rộng trang còn lại

1. Import `PageHeader` cho tiêu đề trang.
2. Thay `bg-white border rounded-xl` → `apple-card`.
3. Nút chính → `apple-btn-primary`, phụ → `apple-btn-secondary`.
4. Panel AI/POS tối giữ `inputClassDark` trong `formFields.jsx`.

## Tài nguyên Apple (tải trên Mac)

- **SF Pro / SF Symbols** — font & icon hệ thống
- **UI Kits** (iOS/macOS) — layout & spacing tham khảo
- **Icon Composer** — app icon Liquid Glass (iOS 26+)

Trên web dùng `-apple-system` thay SF Pro; không cần cài font riêng trên Windows/Linux.
