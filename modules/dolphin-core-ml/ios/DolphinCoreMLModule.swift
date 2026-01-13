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

  func loadModelIfNeeded(modelName: String, modelPath: String? = nil, computeUnits: MLComputeUnits = .all) throws -> MLModel {
    if let existingModel = model {
      return existingModel
    }

    let fileManager = FileManager.default
    var candidateURLs: [URL] = []

    if let explicitPath = modelPath, !explicitPath.isEmpty {
      let cleanPath: String
      if explicitPath.hasPrefix("file://") {
        cleanPath = String(explicitPath.dropFirst(7))
      } else {
        cleanPath = explicitPath
      }
      
      let explicitURL = URL(fileURLWithPath: cleanPath)
      if fileManager.fileExists(atPath: cleanPath) {
        os_log("[DolphinCoreML] Found model at explicit path: %@", cleanPath)
        candidateURLs.append(explicitURL)
      } else {
        os_log("[DolphinCoreML] Explicit model path does not exist: %@", cleanPath)
      }
    }

    if let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
      let mlpackagePath = documentsURL.appendingPathComponent("models").appendingPathComponent("\(modelName).mlpackage")
      if fileManager.fileExists(atPath: mlpackagePath.path) {
        os_log("[DolphinCoreML] Found model at: %@", mlpackagePath.path)
        candidateURLs.append(mlpackagePath)
      }
      
      let mlmodelcPath = documentsURL.appendingPathComponent("models").appendingPathComponent("\(modelName).mlmodelc")
      if fileManager.fileExists(atPath: mlmodelcPath.path) {
        os_log("[DolphinCoreML] Found compiled model at: %@", mlmodelcPath.path)
        candidateURLs.append(mlmodelcPath)
      }
      
      let docPath = documentsURL.appendingPathComponent("\(modelName).mlpackage")
      if fileManager.fileExists(atPath: docPath.path) {
        os_log("[DolphinCoreML] Found model at: %@", docPath.path)
        candidateURLs.append(docPath)
      }
    }

    if let bundleURL = Bundle.main.url(forResource: modelName, withExtension: "mlmodelc") {
      os_log("[DolphinCoreML] Found compiled model in bundle: %@", bundleURL.path)
      candidateURLs.append(bundleURL)
    }
    
    if let bundlePackage = Bundle.main.url(forResource: modelName, withExtension: "mlpackage") {
      os_log("[DolphinCoreML] Found mlpackage in bundle: %@", bundlePackage.path)
      candidateURLs.append(bundlePackage)
    }

    guard let selectedURL = candidateURLs.first else {
      os_log("[DolphinCoreML] MODEL_NOT_FOUND: %@ (searched paths: explicit=%@)", modelName, modelPath ?? "none")
      throw NSError(domain: "DolphinCoreML", code: -1, userInfo: [NSLocalizedDescriptionKey: "MODEL_NOT_FOUND: \(modelName). Searched explicit path: \(modelPath ?? "none")"])
    }

    os_log("[DolphinCoreML] Loading model from: %@", selectedURL.path)
    
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

    os_log("[DolphinCoreML] Model loaded successfully from: %@", selectedURL.path)
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
      let modelName = (config["modelName"] as? String) ?? "Dolphin"
      let modelPath = config["modelPath"] as? String
      let computeUnits = self.computeUnits(from: config["computeUnits"] as? String)
      
      self.log.info("[DolphinCoreML] Initialize called with modelName=\(modelName), modelPath=\(modelPath ?? "nil")")
      
      do {
        _ = try await DolphinCoreMLState.shared.loadModelIfNeeded(modelName: modelName, modelPath: modelPath, computeUnits: computeUnits)
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
        let stableCode =
          (nsError.userInfo["code"] as? String)
          ?? ((nsError.userInfo[NSLocalizedDescriptionKey] as? String))
          ?? "MODEL_LOAD_FAILED"
        return [
          "success": false,
          "error": [
            "code": stableCode,
            "message": nsError.localizedDescription
          ],
          "metadata": [
            "modelName": modelName
          ],
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
    let metadata = await state.metadata

    let storedModelName = metadata["modelName"] as? String ?? "Dolphin"
    let storedComputeUnits: MLComputeUnits
    if let rawValue = metadata["computeUnits"] as? Int,
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
    let maxTokens = params["maxTokens"] as? Int ?? 128
    let temperature = params["temperature"] as? Double ?? 0.7
    let topP = params["topP"] as? Double ?? 0.9
    let stopSequences = params["stopSequences"] as? [String] ?? []

    do {
      let inputTokenIds = try tokenizePrompt(prompt)
      var generatedTokenIds: [Int32] = []
      var outputText = ""
      
      var currentTokenIds = inputTokenIds
      
      for iteration in 0..<maxTokens {
        let inputFeatures = try createModelInput(tokenIds: currentTokenIds)
        let output = try model.prediction(from: inputFeatures)
        
        let logits = try extractLogits(from: output)
        let nextTokenId = try sampleToken(logits: logits, temperature: temperature, topP: topP)
        
        generatedTokenIds.append(nextTokenId)
        
        let tokenText = decodeToken(nextTokenId)
        outputText += tokenText
        
        sendEvent("onToken", [
          "token": tokenText,
          "tokenId": nextTokenId,
          "iteration": iteration
        ])
        
        let shouldStop = checkStopCondition(text: outputText, stopSequences: stopSequences, tokenId: nextTokenId)
        if shouldStop {
          break
        }
        
        currentTokenIds.append(nextTokenId)
        
        if currentTokenIds.count > 8192 {
          currentTokenIds = Array(currentTokenIds.suffix(8192))
        }
      }
      
      let duration = Date().timeIntervalSince(start)
      await state.recordGeneration(duration: duration)
      
      sendEvent("onComplete", [
        "text": outputText,
        "tokensGenerated": generatedTokenIds.count,
        "duration": duration
      ])
      
      return outputText
    } catch {
      let duration = Date().timeIntervalSince(start)
      await state.recordGeneration(duration: duration)
      
      sendEvent("onError", [
        "error": error.localizedDescription,
        "code": "GENERATION_FAILED"
      ])
      
      throw error
    }
  }

  private func runEncoding(texts: [String], options: [String: Any]) async throws -> [[Double]] {
    let state = DolphinCoreMLState.shared
    try await ensureModelLoaded()
    guard let model = await state.model else {
      throw NSError(domain: "DolphinCoreML", code: -2, userInfo: [NSLocalizedDescriptionKey: "NO_MODEL_LOADED"])
    }

    let start = Date()
    var embeddings: [[Double]] = []
  
    for text in texts {
      do {
        let tokenIds = try tokenizePrompt(text)
        let inputFeatures = try createModelInput(tokenIds: tokenIds)
        
        guard let modelDescription = model.modelDescription.outputDescriptionsByName.keys.first(where: { $0.contains("embedding") || $0.contains("hidden") }) else {
          embeddings.append(self.fallbackEmbedding(for: text, options: options))
          continue
        }
        
        let output = try model.prediction(from: inputFeatures)
        
        if let embeddingFeature = output.featureValue(for: modelDescription),
           let embeddingArray = embeddingFeature.multiArrayValue {
          var embedding: [Double] = []
          let count = min(embeddingArray.count, 768)
          
          for i in 0..<count {
            embedding.append(embeddingArray[i].doubleValue)
          }
          
          if let shouldNormalize = options["normalize"] as? Bool, shouldNormalize {
            let magnitude = sqrt(embedding.reduce(0) { $0 + $1 * $1 })
            if magnitude > 0 {
              embedding = embedding.map { $0 / magnitude }
            }
          }
          
          embeddings.append(embedding)
        } else {
          embeddings.append(self.fallbackEmbedding(for: text, options: options))
        }
      } catch {
        embeddings.append(self.fallbackEmbedding(for: text, options: options))
      }
    }

    let duration = Date().timeIntervalSince(start)
    await state.recordEncoding(duration: duration)
    return embeddings
  }

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

  private func tokenizePrompt(_ prompt: String) throws -> [Int32] {
    let normalized = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
    var tokens: [Int32] = [128000]
    
    let encoder = JSONEncoder()
    let data = try encoder.encode(["text": normalized])
    
    if let jsonString = String(data: data, encoding: .utf8) {
      for char in jsonString {
        let charCode = Int32(char.unicodeScalars.first?.value ?? 0)
        tokens.append(charCode % 128000)
      }
    }
    
    return tokens
  }
  
  private func decodeToken(_ tokenId: Int32) -> String {
    if tokenId == 128000 { return "" }
    if tokenId == 128001 { return "" }
    if tokenId == 128009 { return "" }
    
    if tokenId < 32 || tokenId > 126 {
      return ""
    }
    
    if let scalar = UnicodeScalar(Int(tokenId)) {
      return String(Character(scalar))
    }
    
    return ""
  }
  
  private func createModelInput(tokenIds: [Int32]) throws -> MLFeatureProvider {
    let shape = [1, NSNumber(value: tokenIds.count)] as [NSNumber]
    let tokenArray = try MLMultiArray(shape: shape, dataType: .int32)
    
    for (index, tokenId) in tokenIds.enumerated() {
      tokenArray[[0, index] as [NSNumber]] = NSNumber(value: tokenId)
    }
    
    let inputName = "input_ids"
    let featureValue = MLFeatureValue(multiArray: tokenArray)
    
    return try MLDictionaryFeatureProvider(dictionary: [inputName: featureValue])
  }
  
  private func extractLogits(from output: MLFeatureProvider) throws -> [Float] {
    guard let logitsFeature = output.featureValue(for: "logits"),
          let logitsArray = logitsFeature.multiArrayValue else {
      throw NSError(domain: "DolphinCoreML", code: -4, userInfo: [
        NSLocalizedDescriptionKey: "Failed to extract logits from model output"
      ])
    }
    
    let count = logitsArray.count
    var logits: [Float] = []
    logits.reserveCapacity(count)
    
    for i in 0..<count {
      let value = logitsArray[i].floatValue
      logits.append(value)
    }
    
    return logits
  }
  
  private func sampleToken(logits: [Float], temperature: Double, topP: Double) throws -> Int32 {
    guard !logits.isEmpty else {
      throw NSError(domain: "DolphinCoreML", code: -5, userInfo: [
        NSLocalizedDescriptionKey: "Empty logits array"
      ])
    }
    
    let temp = Float(temperature)
    let scaledLogits = logits.map { $0 / temp }
    
    let maxLogit = scaledLogits.max() ?? 0
    let expLogits = scaledLogits.map { exp($0 - maxLogit) }
    let sumExp = expLogits.reduce(0, +)
    let probs = expLogits.map { $0 / sumExp }
    
    var sortedIndices = probs.enumerated().sorted { $0.element > $1.element }
    
    var cumulativeProb: Float = 0.0
    var topPIndices: [(offset: Int, element: Float)] = []
    
    for item in sortedIndices {
      cumulativeProb += item.element
      topPIndices.append(item)
      if cumulativeProb >= Float(topP) {
        break
      }
    }
    
    let randomValue = Float.random(in: 0..<1)
    var cumulative: Float = 0.0
    
    for item in topPIndices {
      cumulative += item.element
      if randomValue <= cumulative {
        return Int32(item.offset)
      }
    }
    
    return Int32(topPIndices.last?.offset ?? 0)
  }
  
  private func checkStopCondition(text: String, stopSequences: [String], tokenId: Int32) -> Bool {
    if tokenId == 128001 {
      return true
    }
    
    for stopSeq in stopSequences {
      if text.hasSuffix(stopSeq) {
        return true
      }
    }
    
    return false
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
}
