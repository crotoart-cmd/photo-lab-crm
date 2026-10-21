require 'json'

Pod::Spec.new do |s|
  s.name = 'CapacitorDeviceSmtp'
  s.version = '1.0.0'
  s.summary = 'SMTP Gmail từ iPhone với Keychain'
  s.license = 'MIT'
  s.homepage = 'https://github.com/crotoart-cmd/photo-lab-crm'
  s.author = 'HDTLabx'
  s.source = { :git => 'https://github.com/crotoart-cmd/photo-lab-crm.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.{swift,h,m}'
  s.dependency 'Capacitor'
  s.dependency 'CocoaAsyncSocket', '~> 7.6'
  s.ios.deployment_target = '13.0'
  s.swift_version = '5.1'
end
