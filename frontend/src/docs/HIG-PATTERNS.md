# Apple HIG → HDTLabx

Tham chiếu: [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)

## Foundations (đã có trong code)

| HIG | File / class |
|-----|----------------|
| Typography (SF Pro stack) | `styles/apple-design.css` — `--font-sans` |
| Color (label, fill, systemBlue) | `--color-label`, `--color-blue`, … |
| Layout & materials | `.apple-card`, `.apple-glass` |

## Patterns → tính năng CRM

| Pattern HIG | Áp dụng trong app |
|-------------|-------------------|
| **Entering data** | `IntakeChecklistForm`, `formFields.jsx`, tab Tiếp nhận |
| **Feedback** | `FeedbackBanner.jsx`, `apple-alert-*` |
| **Loading** | `LoadingIndicator.jsx`, upload/email async |
| **Modality** | `Modal.jsx` — sheet, Escape, tap backdrop |
| **File management** | Upload scan, Google Drive sync |
| **Collaboration and sharing** | Email phiếu, link gallery / Drive |
| **Managing notifications** | Email tráng xong, trả ảnh (backend) |
| **Onboarding** | Login + checklist tiếp nhận (có thể thêm tour) |
| **Offering help** | Ghi chú phiếu, `TEST_EMAIL_TO` banner (tùy chọn) |
| **Charting data** | `Dashboard.jsx` + `StatCard` |
| **Launching** | `App.jsx` routes, deep link `/delivery/:slug` |
| **Drag and drop** | Có thể thêm vào `DeliveryUploadPanel` |
| **Going full screen** | In phiếu `TicketSlip` (`window.print`) |
| **Multitasking** | Layout sidebar + mobile tab bar |

## Components tiếp theo (ưu tiên)

1. Films / Retail — thay `md-*` dần bằng `apple-*`
2. Upload — drag-and-drop (HIG File management)
3. Dashboard — chart đơn giản (HIG Charting data)
4. Empty states khi chưa có phiếu (HIG Feedback)
