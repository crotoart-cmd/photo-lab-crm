#!/bin/bash
# Build + cài Nước Lèo CRM lên thiết bị Android (Lenovo Y700…)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS_APP="$ROOT/ios-app"
TOOLS="$ROOT/.tools"
NODE="$TOOLS/node/bin"
JAVA_HOME_CANDIDATE="$TOOLS/jdk-17/Contents/Home"
ANDROID_SDK="$TOOLS/android-sdk"

export PATH="$NODE:$PATH"
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

if [ ! -x "$JAVA_HOME_CANDIDATE/bin/java" ]; then
  echo "❌ Chưa có JDK. Chạy trước: bash ios-app/scripts/bootstrap-android-tools.sh"
  exit 1
fi
export JAVA_HOME="$JAVA_HOME_CANDIDATE"
export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_SDK_ROOT="$ANDROID_SDK"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

cd "$IOS_APP"

if [ ! -d node_modules/@capacitor/android ]; then
  echo "📦 npm install..."
  npm install --no-fund --no-audit
fi

node scripts/ensure-android-sdk.js

if [ ! -d android ]; then
  echo "➕ Thêm platform Android..."
  npx cap add android
fi

# local.properties mỗi lần
mkdir -p android
echo "sdk.dir=$ANDROID_SDK" > android/local.properties

NET_SEC="android/app/src/main/res/xml/network_security_config.xml"
mkdir -p "$(dirname "$NET_SEC")"
cat > "$NET_SEC" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
XML

MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  if grep -q 'networkSecurityConfig="/' "$MANIFEST"; then
    perl -i -pe 's|android:networkSecurityConfig="/[^"]*"|android:networkSecurityConfig="@xml/network_security_config"|g' "$MANIFEST"
  elif ! grep -q 'networkSecurityConfig' "$MANIFEST"; then
    perl -i -0pe 's/<application(\s+)/<application$1android:networkSecurityConfig="@xml\/network_security_config" /' "$MANIFEST" || true
  fi
fi

echo "🌐 Build frontend → www/"
node scripts/build-frontend.js

echo "🔄 cap sync android"
npx cap sync android

ADB="$ANDROID_HOME/platform-tools/adb"
if [ ! -x "$ADB" ]; then
  echo "❌ Không thấy adb"
  exit 1
fi

echo ""
echo "📱 Thiết bị ADB:"
"$ADB" devices -l

DEVICE_COUNT=$("$ADB" devices | awk 'NR>1 && $2=="device" {c++} END{print c+0}')
if [ "$DEVICE_COUNT" -lt 1 ]; then
  echo ""
  echo "⚠️  Chưa có máy Android ở trạng thái 'device'."
  echo "   1. Cắm USB Lenovo Y700 vào Mac"
  echo "   2. Bật Developer options + USB debugging"
  echo "   3. Cho phép gỡ lỗi USB trên máy"
  echo "   4. Chạy lại: npm run install:y700"
  echo ""
  echo "APK debug vẫn sẽ được build để sẵn sàng cài sau."
fi

echo "🏗️  Assemble debug APK..."
(
  cd android
  chmod +x gradlew
  ./gradlew assembleDebug
)

APK="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "❌ Không tìm thấy $APK"
  exit 1
fi
echo "✅ APK: $IOS_APP/$APK"

if [ "$DEVICE_COUNT" -ge 1 ]; then
  echo "📲 Cài lên thiết bị..."
  "$ADB" install -r "$APK"
  # Launch
  "$ADB" shell am start -n com.nuocleo.crm/.MainActivity 2>/dev/null || \
    "$ADB" shell monkey -p com.nuocleo.crm -c android.intent.category.LAUNCHER 1
  echo "✅ Đã cài & mở Nước Lèo CRM trên Android"
else
  echo "ℹ️  Khi Y700 đã kết nối: adb install -r $APK"
fi
