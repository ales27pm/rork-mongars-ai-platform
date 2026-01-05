import Foundation
import ExpoModulesCore
import CoreML
import NaturalLanguage
import os
import UIKit

actor DolphinCoreMLState {
  static let shared = DolphinCoreMLState()

  private(set) var model: MLModel?
  private(set) var modelURL: URL?
  private(set) var totalInferences: Int = 0
  private(set) var generationDurations: [TimeInterval] = []
  private(set) var encodingDurations: [TimeInterval] = []
  private(set) var lastOperationDuration: TimeInterval?
  private(set) var lastOperationType: String?
  private(set) var metadata: [String: Any] = [:]

  func unload() {
    model = nil
    metadata = [:]
    totalInferences = 0
    generationDurations = []
    encodingDurations = []
    lastOperationDuration = nil
    lastOperationType = nil
    os_log("[DolphinCoreML] Model unloaded and metrics reset")
  }

  func loadModelIfNeeded(modelName: String, computeUnits: MLComputeUnits = .all) throws -> MLModel {
    if let existingModel = model {
      return existingModel
    }

    let fileManager = FileManager.default
    let compiledExtension = "mlmodelc"

    var candidateURLs: [URL] = []

    if let bundleURL = Bundle.main.url(forResource: modelName, withExtension: compiledExtension) {
      candidateURLs.append(bundleURL)
    }

    if let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
      let docURL = documentsURL.appendingPathComponent("\(modelName).\(compiledExtension)")
      if fileManager.fileExists(atPath: docURL.path) {
        candidateURLs.append(docURL)
      }
    }

    guard let selectedURL = candidateURLs.first else {
      throw NSError(domain: "DolphinCoreML", code: -1, userInfo: [NSLocalizedDescriptionKey: "MODEL_NOT_FOUND"])
    }

    let configuration = MLModelConfiguration()
    configuration.computeUnits = computeUnits

    let loadedModel = try MLModel(contentsOf: selectedURL, configuration: configuration)
    model = loadedModel
    modelURL = selectedURL
    metadata = [
      "modelName": modelName,
      "modelPath": selectedURL.path,
      "loadedAt": Date().timeIntervalSince1970,
      "computeUnits": computeUnits.rawValue
    ]

    return loadedModel
  }

  func recordGeneration(duration: TimeInterval) {
      generationDurations.append(duration)
      if generationDurations.count > 1000 {
        generationDurations.removeFirst(generationDurations.count - 1000)
      }
      totalInferences += 1
      lastOperationDuration = duration
      lastOperationType = "generation"
    }

    func recordEncoding(duration: TimeInterval) {
      encodingDurations.append(duration)
      if encodingDurations.count > 1000 {
        encodingDurations.removeFirst(encodingDurations.count - 1000)
      }
      totalInferences += 1
    lastOperationDuration = duration
    lastOperationType = "encoding"
  }

  func metrics() -> [String: Any] {
    func stats(from values: [TimeInterval]) -> [String: Any]? {
      guard !values.isEmpty else { return nil }
      let sorted = values.sorted()
      let count = sorted.count
      let average = sorted.reduce(0, +) / Double(count)
      let median = sorted[count / 2]
      let p95Index = Int(Double(count - 1) * 0.95)
      let p95 = sorted[min(p95Index, count - 1)]

      return [
        "average": average,
        "median": median,
        "p95": p95,
        "count": count
      ]
    }

    return [
      "encoding": stats(from: encodingDurations) ?? [:],
      "generation": stats(from: generationDurations) ?? [:],
      "totalInferences": totalInferences,
      "lastOperationDuration": lastOperationDuration ?? 0,
      "lastOperationType": lastOperationType ?? ""
    ]
  }
}

public class DolphinCoreMLModule: Module {
  private let log = Logger(subsystem: "app.27pm.mongars", category: "DolphinCoreML")

  public func definition() -> ModuleDefinition {
    Name("DolphinCoreML")

    Events("onToken", "onComplete", "onError")

    AsyncFunction("initialize") { (config: [String: Any]) -> [String: Any] in
      if #available(iOS 18.0, *) {
        let modelName = (config["modelName"] as? String) ?? "Dolphin"
        let computeUnits = self.computeUnits(from: config["computeUnits"] as? String)
        do {
          _ = try await DolphinCoreMLState.shared.loadModelIfNeeded(modelName: modelName, computeUnits: computeUnits)
          let deviceInfo = self.collectDeviceInfo()
          var metadata = await DolphinCoreMLState.shared.metadata
          metadata["contextLength"] = 8192
          metadata["version"] = "3.0"
          metadata["computeUnits"] = computeUnits.rawValue

          return [
            "success": true,
            "metadata": metadata,
            "deviceInfo": deviceInfo
          ]
        } catch {
          self.log.error("Failed to load model: \(error.localizedDescription)")
          let nsError = error as NSError
          return [
            "success": false,
            "error": [
              "code": String(nsError.code),
              "message": nsError.localizedDescription
            ],
            "metadata": [
              "modelName": modelName
            ],
            "deviceInfo": self.collectDeviceInfo()
          ]
        }
      } else {
        return [
          "success": false,
          "error": [
            "code": "UNSUPPORTED_PLATFORM",
            "message": "iOS 18 or later is required to run DolphinCoreML."
          ],
          "metadata": [:],
          "deviceInfo": self.collectDeviceInfo()
        ]
      }
    }

    AsyncFunction("generateStream") { [weak self] (prompt: String, params: [String: Any]?) -> String in
      guard let self else { return "" }

      return try await self.runGeneration(prompt: prompt, params: params ?? [:])
    }

    AsyncFunction("encodeBatch") { (texts: [String], options: [String: Any]?) -> [[Double]] in
      return try await self.runEncoding(texts: texts, options: options ?? [:])
    }

    AsyncFunction("getMetrics") { () -> [String: Any] in
      return await DolphinCoreMLState.shared.metrics()
    }

    AsyncFunction("unloadModel") {
      await DolphinCoreMLState.shared.unload()
      return true
    }
  }

  private func collectDeviceInfo() -> [String: Any] {
    let processInfo = ProcessInfo.processInfo
    return [
      "deviceModel": UIDevice.current.model,
      "systemVersion": UIDevice.current.systemVersion,
      "processorCount": processInfo.processorCount,
      "physicalMemory": processInfo.physicalMemory,
      "thermalState": processInfo.thermalState.rawValue,
      "isLowPowerModeEnabled": processInfo.isLowPowerModeEnabled
    ]
  }

  private func computeUnits(from value: String?) -> MLComputeUnits {
    switch value {
    case "cpuAndGPU":
      return .cpuAndGPU
    case "cpuOnly":
      return .cpuOnly
    default:
      return .all
    }
  }

  private func ensureModelLoaded() async throws {
    let state = DolphinCoreMLState.shared
    let storedModelName = state.metadata["modelName"] as? String ?? "Dolphin"
    let storedComputeUnits: MLComputeUnits
    if let rawValue = state.metadata["computeUnits"] as? Int,
       let units = MLComputeUnits(rawValue: rawValue) {
      storedComputeUnits = units
    } else {
      storedComputeUnits = .all
    }

    _ = try await state.loadModelIfNeeded(modelName: storedModelName, computeUnits: storedComputeUnits)
  }

  private func runGeneration(prompt: String, params: [String: Any]) async throws -> String {
    let state = DolphinCoreMLState.shared
    try await ensureModelLoaded()
    guard let model = await state.model else {
      throw NSError(domain: "DolphinCoreML", code: -2, userInfo: [NSLocalizedDescriptionKey: "NO_MODEL_LOADED"])
    }

    let start = Date()

    // This is a conceptual implementation. You will need to adapt it to your model's specifics.
    // e.g., use your actual tokenizer, and match model input/output names and shapes.
  
    // 1. Tokenize prompt (replace with your actual tokenizer)
    // let inputTokens = MyTokenizer.encode(prompt)

    // 2. Run prediction loop
    var outputText = ""
    // for _ in 0..<(params["maxTokens"] as? Int ?? 128) {
    //   let inputFeatureProvider = try createModelInput(tokens: inputTokens)
    //   let output = try model.prediction(from: inputFeatureProvider)
    //
    //   // 3. Process output and decode token (replace with your logic)
    //   let nextToken = processModelOutput(output)
    //   let nextTokenString = MyTokenizer.decode(nextToken)
    //
    //   // 4. Append to results and emit event
    //   outputText += nextTokenString
    //   sendEvent("onToken", ["token": nextTokenString])
    //
    //   // 5. Check for end-of-sequence token
    //   if nextToken == MyTokenizer.endTokenId { break }
    //
    //   inputTokens.append(nextToken)
    // }

    // Generation is not implemented yet; fail fast so callers can handle it.
    let error = NSError(domain: "DolphinCoreML", code: -3, userInfo: [
      NSLocalizedDescriptionKey: "NOT_IMPLEMENTED"
    ])
    sendEvent("onError", ["message": error.localizedDescription])
    throw error

    let duration = Date().timeIntervalSince(start)
    await state.recordGeneration(duration: duration)
    return result
  }

  private func runEncoding(texts: [String], options: [String: Any]) async throws -> [[Double]] {
    let state = DolphinCoreMLState.shared
    try await ensureModelLoaded()
    guard let model = await state.model else {
      throw NSError(domain: "DolphinCoreML", code: -2, userInfo: [NSLocalizedDescriptionKey: "NO_MODEL_LOADED"])
    }

    let start = Date()
    var embeddings: [[Double]] = []
  
    // This is a conceptual implementation. You will need to adapt it to your model's specifics.
    for text in texts {
      // let inputFeatureProvider = try createEmbeddingInput(text: text) // Prepare model input
      // let output = try model.prediction(from: inputFeatureProvider)
      // if let embeddingVector = extractEmbedding(from: output) { // Extract embedding from output
      //   embeddings.append(embeddingVector)
      // } else {
        // Fallback to existing logic if model prediction fails
        embeddings.append(self.fallbackEmbedding(for: text, options: options))
      // }
    }

    let duration = Date().timeIntervalSince(start)
    await state.recordEncoding(duration: duration)
    return embeddings
  }

  // Extracted fallback logic for clarity
  private func fallbackEmbedding(for text: String, options: [String: Any]) -> [Double] {
    let shouldNormalize = options["normalize"] as? Bool ?? true
    let maxLength = options["maxLength"] as? Int ?? 512
    let truncationEnabled = options["truncation"] as? Bool ?? true

    let preparedText: String
    if truncationEnabled && text.count > maxLength {
      let index = text.index(text.startIndex, offsetBy: maxLength)
      preparedText = String(text[..<index])
    } else {
      preparedText = text
    }

    if let embedding = NLEmbedding.wordEmbedding(forLanguage: .english) {
      let tokens = preparedText.split(separator: " ").map(String.init)
      let vectors = tokens.compactMap { embedding.vector(for: $0) }
      if let first = vectors.first {
        let dimension = first.count
        var aggregate = Array(repeating: 0.0, count: dimension)

        for vector in vectors {
          for (index, value) in vector.enumerated() {
            aggregate[index] += Double(value)
          }
        }

        let count = Double(max(vectors.count, 1))
        var averaged = aggregate.map { $0 / count }

        if shouldNormalize {
          let magnitude = sqrt(averaged.reduce(0) { $0 + $1 * $1 })
          if magnitude > 0 {
            averaged = averaged.map { $0 / magnitude }
          }
        }
        return averaged
      }
    }
    return self.generateDeterministicEmbedding(text: preparedText, dimension: 300, normalize: shouldNormalize)
  }

  private func generateDeterministicEmbedding(text: String, dimension: Int, normalize: Bool) -> [Double] {
    var hash = UInt64(5381)
    for scalar in text.unicodeScalars {
      hash = ((hash << 5) &+ hash) &+ UInt64(scalar.value)
    }

    var values: [Double] = []
    values.reserveCapacity(dimension)
    for i in 0..<dimension {
      let seed = Double((hash &+ UInt64(i * 31)) % UInt64.max) / Double(UInt64.max)
      values.append(sin(seed * Double.pi * 2.0))
    }

    guard normalize else { return values }

    let magnitude = sqrt(values.reduce(0) { $0 + $1 * $1 })
    guard magnitude > 0 else { return values }
      return values.map { $0 / magnitude }
    }
