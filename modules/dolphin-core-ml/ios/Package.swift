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
    dependencies: [
        .package(
            url: "https://github.com/ml-explore/mlx-swift",
            revision: "072b684acaae80b6a463abab3a103732f33774bf"
        ),
        .package(
            url: "https://github.com/ml-explore/mlx-swift-examples",
            revision: "9bff95ca5f0b9e8c021acc4d71a2bbe4a7441631"
        ),
        .package(
            url: "https://github.com/huggingface/swift-transformers",
            from: "1.0.0"
        )
    ],
    targets: [
        .target(
            name: "DolphinCoreML",
            dependencies: [
                .product(name: "MLX", package: "mlx-swift"),
                .product(name: "MLXNN", package: "mlx-swift"),
                .product(name: "MLXOptimizers", package: "mlx-swift"),
                .product(name: "MLXRandom", package: "mlx-swift"),
                .product(name: "MLXLinalg", package: "mlx-swift"),
                .product(name: "MLXFFT", package: "mlx-swift"),
                .product(name: "MLXLLM", package: "mlx-swift-examples"),
                .product(name: "MLXLMCommon", package: "mlx-swift-examples"),
                .product(name: "Hub", package: "swift-transformers"),
                .product(name: "Tokenizers", package: "swift-transformers")
            ],
            path: ".",
            sources: [
                "DolphinCoreMLModule.swift",
                "MLXBridge.swift",
                "MLXEngine.swift"
            ]
        )
    ]
)
