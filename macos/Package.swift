// swift-tools-version: 6.0
import PackageDescription
let package = Package(
    name: "HarnessBridge",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "HarnessBridge", targets: ["HarnessBridge"])],
    targets: [.executableTarget(name: "HarnessBridge")]
)
