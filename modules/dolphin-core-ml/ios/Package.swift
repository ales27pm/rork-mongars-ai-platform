// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DolphinCoreML",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "DolphinCoreML",
            targets: ["DolphinCoreML"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "DolphinCoreML",
            dependencies: [],
            path: ".",
            sources: [
                "DolphinCoreMLModule.swift"
            ]
        )
    ]
)
