# Design System — HDTLabx

Tài liệu tham chiếu cho UI (ưu tiên **mobile iPhone**). Agent và dev tra đây trước khi tạo component/CSS mới.

## Nguyên tắc kế thừa

```
Tokens (CSS vars)
  → Primitives (TextField, Button, AppleMenu…)
    → Patterns (intake-form-actions, dashboard-period-block…)
      → Pages (Retail, Dashboard…)
```

- **Mobile** là nguồn chính (`html.mobile-app` trong `main.jsx`).
- **Desktop:** cùng primitive, thêm `md:` / `max-md:hidden` — không fork panel riêng trừ khi bắt buộc.

## Tokens

| Loại | File |
|------|------|
| Màu, surface, shadow | `frontend/src/styles/apple-design.css` |
| Thang chữ iOS | `frontend/src/styles/apple-typography.css` |
| Shell iPhone | `frontend/src/styles/ios-iphone.css`, `mobile-shell.css` |
| Nút pill | `frontend/src/styles/buttons.css` (`btn-pill--lv1` primary, `lv2` secondary) |

### Typography mobile (chuẩn section title — giống Dashboard)

- Tiêu đề section: `0.9375rem`, `font-weight: 600`, `letter-spacing: -0.02em`, màu `--color-label`
- **Không** uppercase + letter-spacing rộng (trừ caption/phụ)

### Màu accent

- Primary blue: `--color-blue` / `#0070FF` (icon accent)
- Text chính: `--color-label` · phụ: `--color-label-secondary`

## Shell

| Thành phần | File |
|------------|------|
| Page wrapper | `components/mobile/IosPage.jsx` |
| Top bar | `MobileNavBar.jsx` |
| Tab bar | `MobileTabBar.jsx` + `styles/tab-bar.css` |
| Drawer | `NavDrawer.jsx` |

## Tài liệu liên quan

- [components.md](./components.md) — bảng component → file
- [figma-map.md](./figma-map.md) — map Figma → code (điền link Figma dần)

## Khi thêm UI mới

1. Đọc `components.md` — có primitive chưa?
2. Đọc `figma-map.md` — đã có icon/frame chưa?
3. Style mới: mở rộng file CSS domain (`retail-ios.css`, `dashboard-widgets.css`…) thay vì inline.
4. Import CSS global qua `frontend/src/index.css`.
