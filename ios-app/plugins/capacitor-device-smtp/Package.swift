// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "CapacitorDeviceSmtp",
    platforms: [.iOS(.v13)],
    products: [
        .library(name: "CapacitorDeviceSmtp", targets: ["DeviceSmtpPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "6.0.0")
    ],
    targets: [
        .target(
            name: "DeviceSmtpPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/DeviceSmtpPlugin"
        )
    ]
)
