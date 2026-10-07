# Component map

Bảng tra nhanh — **dùng lại** trước khi tạo mới.

## Form & input

| UI | Component | Ghi chú |
|----|-----------|---------|
| Text field | `TextField.jsx` | Label, error, trailing icon, readonly |
| Labeled wrappers | `formFields.jsx` → `LabeledInput`, `LabeledTextarea`, `LabeledSelect` |
| Select / dropdown | `AppleSelect.jsx` | Menu kiểu Apple, không native `<select>` mobile |
| Menu popover | `AppleMenu.jsx` | `AppleMenuPanel`, `AppleMenuItem`, portal |
| Search pill | `SearchField.jsx` | 40px, quét kèm `SearchFieldAction` |
| Giá nhập/bán/sàn | `PriceFieldsRow.jsx` | |
| Segmented | `AppleSegmentedControl.jsx` | |
| Server URL | `ServerUrlField.jsx` | |

## Nút & hành động

| UI | Class / component |
|----|-------------------|
| Primary | `apple-btn-primary` + `btn-pill--block` |
| Secondary | `apple-btn-secondary` + `btn-pill--block` |
| Generic | `Button.jsx` (`variant`: primary, outline, …) |
| Footer 2 nút (In + Lưu) | `intake-form-actions` + `--dual` (`intake-form-actions.css`) |
| Refresh | `RefreshButton.jsx` |

## Retail / Kho

| Màn / khối | File |
|------------|------|
| Trang Kho & bán | `pages/Retail.jsx` |
| Tab Nhập | `SmartIntakePanel.jsx` + `retail-ios.css` |
| Tab Bán | `SmartSalePanel.jsx` |
| Quét + ô mã | `retail/ProductScanSearchRow.jsx` |
| Danh mục kho (3 ô) | `retail-group-btn` trong `SmartIntakePanel` |
| Tồn kho list | `retail/IntakeStockList.jsx` |
| Tồn máy ảnh | `retail/MobileCameraStockPanel.jsx` |
| Giỏ mobile | `retail/MobileCartCard.jsx` |
| In tem mã quầy | `utils/printCameraCounterLabel.js` |
| Mã quầy logic | `generateCounterCode` trong `SmartIntakePanel` |

## Dashboard

| UI | File |
|----|------|
| Trang | `pages/Dashboard.jsx` |
| Khối kỳ | `dashboard-period-block` (`dashboard-segment.css`) |
| Chọn kỳ dropdown | `dashboard/PeriodRangeSelect.jsx` + `periodRange.js` |
| Donut / charts | `DonutChart.jsx`, `LabFilmCharts.jsx`, `DashboardAnalyticsPanels.jsx` |
| KPI strip | `CounterBar.jsx`, `DashboardMetricCard.jsx` |

## Khách hàng & film

| UI | File |
|----|------|
| Khách mobile | `customers/CustomerMobileCard.jsx`, `pages/Customers.jsx` |
| Tìm khách | `CustomerSearchPicker.jsx` |
| Phiếu film | `pages/Films.jsx`, `TicketSlip.jsx` |
| Checklist tiếp nhận | `IntakeChecklistForm.jsx` |

## Feedback

| UI | File |
|----|------|
| Toast | `ToastMessage.jsx` + `toast-ios.css` |
| Status chip | `StatusPill.jsx` + `status-pill.css` |
| Modal | `Modal.jsx` |
| Loading | `LoadingIndicator.jsx`, `icons/IconLoading.jsx` |

## Icons (Figma 32px)

| Ngữ cảnh | Size (`iconSizes.js`) | File |
|----------|----------------------|------|
| Tab bar | `tab: 24` | `tabBarIcons.jsx` |
| Field / search | `field: 20` | |
| Row action 40px | `rowAction: 22` | `rowActionIcon.jsx` |
| Nav drawer | `nav: 22` | `NavItemIcon.jsx` |

Chi tiết từng icon → [figma-map.md](./figma-map.md).

## Pages → route

| Route | Page |
|-------|------|
| `/` | `Dashboard.jsx` |
| `/retail?tab=intake\|sale` | `Retail.jsx` |
| `/customers` | `Customers.jsx` |
| `/films` | `Films.jsx` |
| `/inventory` | `Inventory.jsx` |
| `/repairs` | `Repairs.jsx` |
| `/profile` | `Profile.jsx` |
