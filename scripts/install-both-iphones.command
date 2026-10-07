#!/bin/bash
# Double-click (Finder / Dock) — cài 2 app: USB hoặc Wi‑Fi sau khi pair Xcode 1 lần.
cd "$(dirname "$0")/.."
bash scripts/install-both-iphones.sh "$@"
status=$?

if [ "$status" -eq 0 ]; then
  osascript -e 'display notification "Nước Lèo CRM + 35Daylight — cài xong." with title "Cài iPhone"' 2>/dev/null || true
else
  osascript -e 'display notification "Xem cửa sổ Terminal để biết lỗi." with title "Cài iPhone thất bại"' 2>/dev/null || true
fi

echo ""
read -r -p "Nhấn Enter để đóng…" _
exit $status
