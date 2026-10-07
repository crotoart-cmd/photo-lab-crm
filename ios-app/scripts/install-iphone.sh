#!/bin/bash
# Build + cài Nước Lèo CRM lên iPhone (cắm USB, tin máy Mac trên iPhone)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE="$ROOT/../.tools/node/bin"
export PATH="$NODE:$PATH"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

DEVICE_ID="${1:-}"
TEAM_ID="${DEVELOPMENT_TEAM:-MG69LSYTGH}"
DERIVED_DATA="$ROOT/ios/App/.derivedData-nuocleo"
IOS_WORKSPACE="$ROOT/ios/App/App.xcworkspace"

# Bundle ID mong đợi — đọc từ capacitor.config.json.
# Cài com.nuocleo.crm KHÔNG gỡ app khác (vd. com.35daylight.app) — mỗi bundle ID là app riêng trên iPhone.
EXPECTED_BUNDLE_ID="$(
  node -e "
    const c = require('${ROOT}/capacitor.config.json');
    process.stdout.write(c.appId || 'com.nuocleo.crm');
  "
)"

read_bundle_id() {
  /usr/libexec/PlistBuddy -c "Print CFBundleIdentifier" "$1/Info.plist" 2>/dev/null || echo ""
}

if [ -z "$DEVICE_ID" ]; then
  RESOLVE_LIB="$ROOT/../scripts/lib/ios-resolve-device.sh"
  if [ -f "$RESOLVE_LIB" ]; then
    DEVICE_ID="$(bash "$RESOLVE_LIB" 2>/dev/null | head -1 | cut -d'|' -f1 || true)"
  fi
  if [ -z "$DEVICE_ID" ]; then
    DEVICE_ID=$(xcrun xctrace list devices 2>/dev/null | grep -E 'iPhone.*\([0-9]' | grep -v Simulator | head -1 | sed -n 's/.*(\([0-9A-F-]*\)).*/\1/p')
  fi
fi

echo "📦 Build web + copy vào iOS..."
cd "$ROOT"
npm run build:web
npx cap copy ios

echo "📦 CocoaPods..."
cd "$ROOT/ios/App"
if [ -x "$HOME/.gem/ruby/2.6.0/bin/pod" ]; then
  "$HOME/.gem/ruby/2.6.0/bin/pod" install
else
  pod install
fi

LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
echo ""
echo "✅ Sẵn sàng cài lên iPhone"
echo "   Bundle ID: $EXPECTED_BUNDLE_ID"
echo "   API Mac: http://${LAN_IP}:5001/api"
echo "   (iPhone và Mac cùng Wi‑Fi; backend phải đang chạy)"
echo ""

if [ -n "$DEVICE_ID" ]; then
  echo "🔨 Build & cài lên thiết bị $DEVICE_ID..."
  echo "   DerivedData: $DERIVED_DATA"

  xcodebuild -workspace "$IOS_WORKSPACE" -scheme App -configuration Debug \
    -destination "id=$DEVICE_ID" \
    -derivedDataPath "$DERIVED_DATA" \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    CODE_SIGN_STYLE=Automatic \
    build

  APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphoneos/App.app"
  if [ ! -d "$APP_PATH" ]; then
    echo "❌ Không tìm thấy App.app sau build: $APP_PATH" >&2
    exit 1
  fi

  BUNDLE="$(read_bundle_id "$APP_PATH")"
  echo "   Built app bundle: $BUNDLE"

  if [ "$BUNDLE" != "$EXPECTED_BUNDLE_ID" ]; then
    echo "❌ Sai bundle ID (mong đợi $EXPECTED_BUNDLE_ID, nhận $BUNDLE)." >&2
    echo "   Không cài để tránh ghi đè app khác trên iPhone." >&2
    exit 1
  fi

  # Framework Capacitor/Cordova phải có bundle ID riêng — không được trùng app chính
  dup_fw=false
  while IFS= read -r fw; do
    [ -f "$fw/Info.plist" ] || continue
    fw_id="$(read_bundle_id "$fw")"
    if [ "$fw_id" = "$EXPECTED_BUNDLE_ID" ]; then
      echo "❌ Framework $(basename "$fw") trùng bundle ID app ($fw_id) — build lỗi." >&2
      dup_fw=true
    fi
  done < <(find "$APP_PATH/Frameworks" -maxdepth 1 -name '*.framework' 2>/dev/null)
  if [ "$dup_fw" = true ]; then
    echo "   Chạy: rm -rf \"$DERIVED_DATA\" rồi build lại." >&2
    exit 1
  fi

  echo "📲 Cài $BUNDLE..."
  xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
  echo "🚀 Đã cài lên iPhone!"
  exit 0
fi

echo "Mở Xcode — chọn iPhone của bạn rồi bấm ▶ Run (⌘R)"
open "$IOS_WORKSPACE"
