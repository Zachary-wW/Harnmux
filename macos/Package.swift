// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "Harnmux",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "Harnmux", targets: ["Harnmux"])],
    targets: [.executableTarget(name: "Harnmux")]
)
