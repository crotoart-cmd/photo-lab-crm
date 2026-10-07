#!/bin/bash
# Bootstrap JDK 17 + Android cmdline-tools vào .tools/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOOLS="$ROOT/.tools"
mkdir -p "$TOOLS/downloads" "$TOOLS/android-sdk"
cd "$TOOLS/downloads"

export PATH="$ROOT/.tools/node/bin:$PATH"

if [ ! -x "$TOOLS/jdk-17/Contents/Home/bin/java" ]; then
  echo "⬇️  Tải Zulu JDK 17 (aarch64)..."
  # Azul CDN ổn định hơn GitHub/Adoptium trên mạng VN
  curl -L --fail --retry 5 --retry-delay 3 \
    -o zulu17.tar.gz \
    "https://cdn.azul.com/zulu/bin/zulu17.60.17-ca-jdk17.0.16-macosx_aarch64.tar.gz"
  rm -rf "$TOOLS/jdk-17-tmp" "$TOOLS/jdk-17"
  mkdir -p "$TOOLS/jdk-17-tmp"
  tar -xzf zulu17.tar.gz -C "$TOOLS/jdk-17-tmp"
  BUNDLE="$(find "$TOOLS/jdk-17-tmp" -maxdepth 3 -type d -name 'zulu-17.jdk' | head -1)"
  HOME_DIR="$BUNDLE/Contents/Home"
  mkdir -p "$TOOLS/jdk-17/Contents"
  cp -R "$HOME_DIR" "$TOOLS/jdk-17/Contents/Home"
  rm -rf "$TOOLS/jdk-17-tmp"
fi
export JAVA_HOME="$TOOLS/jdk-17/Contents/Home"
echo "✅ JDK: $($JAVA_HOME/bin/java -version 2>&1 | head -1)"

if [ ! -x "$TOOLS/android-sdk/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "⬇️  Tải Android cmdline-tools..."
  curl -L --fail --retry 3 -o cmdline-tools.zip \
    "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
  rm -rf "$TOOLS/android-sdk/cmdline-tools"
  mkdir -p "$TOOLS/android-sdk/cmdline-tools"
  unzip -q cmdline-tools.zip -d "$TOOLS/android-sdk/cmdline-tools"
  if [ -d "$TOOLS/android-sdk/cmdline-tools/cmdline-tools" ]; then
    mv "$TOOLS/android-sdk/cmdline-tools/cmdline-tools" "$TOOLS/android-sdk/cmdline-tools/latest"
  fi
fi
echo "✅ sdkmanager sẵn sàng"

export ANDROID_HOME="$TOOLS/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

node "$ROOT/ios-app/scripts/ensure-android-sdk.js"
echo "✅ Bootstrap Android tools xong"
