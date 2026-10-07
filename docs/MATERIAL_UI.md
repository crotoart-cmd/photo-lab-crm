# UI — Material Design 3

Tham chiếu: [Material Design 3](https://m3.material.io/)

## Menu (Navigation Drawer)

Cụm menu trong `frontend/src/config/navigation.js`:

| Cụm | Mục |
|-----|-----|
| **Tổng quan** | Dashboard |
| **Vận hành lab** | Phiếu film, Khách hàng |
| **Kho & bán lẻ** | Tồn kho tiêu hao, Nhập hàng, Bán hàng — Scan |
| **Tài khoản** | Hồ sơ |

## Tokens & components

- `frontend/src/styles/material-design.css` — màu M3, elevation, nav drawer
- `md-nav-drawer`, `md-nav-item`, `md-card`, `md-btn-filled`, `md-btn-tonal`, `md-btn-text`
- Icon: [Material Symbols](https://fonts.google.com/icons) (Google Fonts)
- Font: Roboto

## Thêm mục menu

Sửa `NAV_GROUPS` trong `navigation.js` và (nếu cần) `isNavItemActive` cho route đặc biệt (query `?tab=`).
