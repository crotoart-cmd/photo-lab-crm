#!/bin/bash
# Cài Nước Lèo CRM + 35Daylight — double-click install-both-iphones.command
# USB hoặc Wi‑Fi (sau khi pair Xcode 1 lần). Cài đè → giữ data local.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PHOTO_LAB_IOS="$ROOT/ios-app/scripts/install-iphone.sh"
DAYLIGHT_IOS="$ROOT/../35daylight-mobile/ios-app/scripts/install-iphone.sh"
RESOLVE_LIB="$ROOT/scripts/lib/ios-resolve-device.sh"
DEVICE_ARG="${1:-}"

export PATH="$ROOT/.tools/node/bin:$PATH"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

if [ ! -f "$PHOTO_LAB_IOS" ] || [ ! -f "$DAYLIGHT_IOS" ]; then
  echo "❌ Thiếu script cài iOS trong repo." >&2
  exit 1
fi

pick_device() {
  if [ ! -f "$RESOLVE_LIB" ]; then
    xcrun xctrace list devices 2>/dev/null | grep -E 'iPhone.*\([0-9]' | grep -v Simulator | head -1 | sed -n 's/.*(\([0-9A-F-]*\)).*/\1/p'
    return
  fi
  bash "$RESOLVE_LIB" "$DEVICE_ARG" 2>/dev/null | head -1 | cut -d'|' -f1
}

DEVICE_ID="$(pick_device || true)"
DEVICE_META=""
if [ -f "$RESOLVE_LIB" ] && [ -n "${DEVICE_ID:-}" ]; then
  DEVICE_META="$(bash "$RESOLVE_LIB" "$DEVICE_ARG" 2>/dev/null | head -1 || true)"
fi

if [ -z "${DEVICE_ID:-}" ]; then
  cat >&2 <<'EOF'
❌ Không thấy iPhone.

Lần đầu (pair):
  1. Cắm USB → mở khóa iPhone → Tin cậy máy Mac
  2. Mở Xcode → Window → Devices and Simulators
  3. Chọn iPhone → bật "Connect via network" (Kết nối qua mạng)
  4. Đợi biểu tượng mạng xuất hiện → rút cáp được

Các lần sau (không cần cáp):
  • Mac + iPhone cùng Wi‑Fi
  • Double-click install-both-iphones.command
EOF
  exit 1
fi

DEVICE_NAME="$(echo "$DEVICE_META" | cut -d'|' -f2)"
DEVICE_VIA="$(echo "$DEVICE_META" | cut -d'|' -f3)"
[ -z "$DEVICE_NAME" ] && DEVICE_NAME="iPhone"
[ -z "$DEVICE_VIA" ] && DEVICE_VIA="USB/Wi‑Fi"

echo "🔑 Chìa khóa (profile dev) nằm ở:"
echo "   • Mac: Keychain → Apple Development (etcstudjo@gmail.com)"
echo "   • iPhone: Cài đặt → VPN & Quản lý thiết bị → Tin developer"
echo "   • Mỗi lần chạy tool này = cấp profile mới ~7 ngày (cài đè, giữ data)"
echo ""
echo "📱 $DEVICE_NAME · $DEVICE_VIA · $DEVICE_ID"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1/2 · Nước Lèo CRM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$PHOTO_LAB_IOS" "$DEVICE_ID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2/2 · 35Daylight"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$DAYLIGHT_IOS" "$DEVICE_ID"

echo ""
echo "✅ Xong cả 2 app."
if [ "$DEVICE_VIA" = "Wi‑Fi" ]; then
  echo "   Đã cài qua Wi‑Fi — không cần cáp lần này."
fi
echo "   Nếu không mở được app → Tin developer trên iPhone (Cài đặt chung)."
