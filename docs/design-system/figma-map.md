# Figma → Code map

Điền cột **Figma link** khi có frame ổn định. Agent: **đọc file này trước**, không đoán SVG từ CSS dump.

Format link: `https://www.figma.com/design/<file>?node-id=<id>`

---

## Icons (Property 1 = 32 stroke)

| Tên Figma | Code | Figma link | Ghi chú |
|-----------|------|------------|---------|
| Icons/Rotate 32 stroke | `icons/IconRotate.jsx` | _điền_ | Mã quầy tự sinh; `#0070FF` + `#323F4B` |
| Icons/Refresh | `icons/IconRefresh.jsx` | _điền_ | Wrapper `IconRotate` framed |
| Icons/Scan | `icons/IconScan.jsx` | _điền_ | Quét barcode, `rowActionIcon` |
| Icons/QR | `icons/IconQR.jsx` | _điền_ | QR khách |
| Icons/Loading | `icons/IconLoading.jsx` | _điền_ | Spinner 2 cung |
| Tab — Overview | `icons/IconOverview.jsx` | _điền_ | Dashboard tab |
| Tab — Nhập | `icons/IconIntake.jsx` | _điền_ | |
| Tab — Bán | `icons/IconSale.jsx` | _điền_ | |
| Icon/Edit | `icons/IconEdit.jsx` | _điền_ | `Icon32` variant edit |
| Icon/Delete | `icons/IconDelete.jsx` | _điền_ | |
| Icon/Filter | `icons/IconFilter.jsx` | _điền_ | SubNavBar |
| Icon/Chevron | `icons/IconChevron.jsx` | _điền_ | Thu gọn panel |
| Khách mới | `icons/SymbolNew.jsx` | _điền_ | |

Frame wrapper: `icons/Icon32.jsx` + `styles/icon-32.css`

---

## Form & controls

| Tên Figma | Code | Figma link |
|-----------|------|------------|
| Text field | `TextField.jsx` + `text-field.css` | _điền_ |
| Search field 40px | `SearchField.jsx` + `search-field.css` | _điền_ |
| Apple menu / dropdown | `AppleMenu.jsx` + `apple-menu.css` | _điền_ |
| Apple select | `AppleSelect.jsx` | _điền_ |
| Segmented control | `AppleSegmentedControl.jsx` | _điền_ |
| Status pill | `StatusPill.jsx` + `status-pill.css` | _điền_ |
| Button pill Lv1/Lv2 | `buttons.css` | _điền_ |

---

## Màn hình (mobile)

| Màn | File chính | Figma link |
|-----|------------|------------|
| Dashboard | `pages/Dashboard.jsx` | _điền_ |
| Pipeline donut | `DonutChart.jsx` + `LabFilmCharts.jsx` | _điền_ |
| Phân tích theo kỳ | `PeriodRangeSelect.jsx` | _điền_ |
| Nhập — Danh mục kho | `SmartIntakePanel` + `retail-group-btn` | _điền_ |
| Nhập — Phiếu máy ảnh | `SmartIntakePanel` detected form | _điền_ |
| Nhập — Footer In + Duyệt | `intake-form-actions.css` | _điền_ |
| Bán POS | `SmartSalePanel.jsx` | _điền_ |
| Tab bar | `MobileTabBar.jsx` | _điền_ |

---

## Cách dùng với Cursor

**Task mẫu:**
```
Theo docs/design-system/figma-map.md dòng "Icons/Rotate".
Chỉ sửa IconRotate.jsx, không đổi layout.
```

**Khi export từ Figma:**
1. Copy SVG → paste path vào file `icons/Icon*.jsx` tương ứng
2. Cập nhật link cột Figma trong bảng trên
3. Giữ `viewBox="0 0 32 32"` và stroke `#0070FF` / `#323F4B` theo spec team
