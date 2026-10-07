#!/usr/bin/env node
/**
 * Đảm bảo JAVA_HOME + ANDROID_HOME trỏ vào .tools/
 * Cài platform-tools, build-tools, platforms nếu thiếu.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const tools = path.join(root, '.tools');
const jdkHome = path.join(tools, 'jdk-17', 'Contents', 'Home');
const androidSdk = path.join(tools, 'android-sdk');
const sdkmanager = path.join(androidSdk, 'cmdline-tools', 'latest', 'bin', 'sdkmanager');

function fail(msg) {
  console.error('❌', msg);
  process.exit(1);
}

if (!fs.existsSync(path.join(jdkHome, 'bin', 'java'))) {
  fail(
    `Chưa có JDK tại ${jdkHome}\n` +
      'Chạy: bash ios-app/scripts/bootstrap-android-tools.sh'
  );
}

if (!fs.existsSync(sdkmanager)) {
  fail(
    `Chưa có sdkmanager tại ${sdkmanager}\n` +
      'Chạy: bash ios-app/scripts/bootstrap-android-tools.sh'
  );
}

process.env.JAVA_HOME = jdkHome;
process.env.ANDROID_HOME = androidSdk;
process.env.ANDROID_SDK_ROOT = androidSdk;
process.env.PATH = [
  path.join(jdkHome, 'bin'),
  path.join(androidSdk, 'platform-tools'),
  path.join(androidSdk, 'cmdline-tools', 'latest', 'bin'),
  process.env.PATH || '',
].join(path.delimiter);

const packages = [
  'platform-tools',
  'platforms;android-34',
  'build-tools;34.0.0',
];

console.log('📦 Cài Android SDK packages (có thể mất vài phút)...');
const yes = spawnSync(
  'bash',
  ['-lc', `yes | "${sdkmanager}" --sdk_root="${androidSdk}" ${packages.map((p) => `"${p}"`).join(' ')}`],
  { stdio: 'inherit', env: process.env }
);

if (yes.status !== 0) {
  fail('sdkmanager thất bại — kiểm tra mạng / JAVA_HOME');
}

const localProps = path.join(__dirname, '..', 'android', 'local.properties');
if (fs.existsSync(path.dirname(localProps))) {
  fs.writeFileSync(localProps, `sdk.dir=${androidSdk.replace(/\\/g, '/')}\n`, 'utf8');
  console.log('✅ android/local.properties →', androidSdk);
}

console.log('✅ Android SDK sẵn sàng');
console.log('   JAVA_HOME=', jdkHome);
console.log('   ANDROID_HOME=', androidSdk);
