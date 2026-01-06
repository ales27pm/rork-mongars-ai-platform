import Foundation
import CoreML
import os

@available(iOS 18.0, *)
public class MLXBridge {
  private let log = Logger(subsystem: "app.27pm.mongars", category: "MLXBridge")
  
  private var model: MLModel?
  private var modelURL: URL?
  
  public init() {}
  
  public func loadModel(at url: URL, configuration: MLModelConfiguration) throws -> MLModel {
    log.info("[MLXBridge] Loading model from: \(url.path)")
    
    let loadedModel = try MLModel(contentsOf: url, configuration: configuration)
    self.model = loadedModel
    self.modelURL = url
    
    log.info("[MLXBridge] Model loaded successfully")
    log.info("[MLXBridge] Model description: \(loadedModel.modelDescription.metadata[MLModelMetadataKey.description] ?? "N/A")")
    
    return loadedModel
  }
  
  public func predict(input: MLFeatureProvider) throws -> MLFeatureProvider {
    guard let model = model else {
      throw NSError(domain: "MLXBridge", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Model not loaded"
      ])
    }
    
    return try model.prediction(from: input)
  }
  
  public func asyncPredict(input: MLFeatureProvider) async throws -> MLFeatureProvider {
    guard let model = model else {
      throw NSError(domain: "MLXBridge", code: -1, userInfo: [
        NSLocalizedDescriptionKey: "Model not loaded"
      ])
    }
    
    return try await model.prediction(from: input)
  }
  
  public func getModelDescription() -> MLModelDescription? {
    return model?.modelDescription
  }
  
  public func getInputFeatures() -> [String: MLFeatureDescription]? {
    return model?.modelDescription.inputDescriptionsByName
  }
  
  public func getOutputFeatures() -> [String: MLFeatureDescription]? {
    return model?.modelDescription.outputDescriptionsByName
  }
  
  public func unloadModel() {
    model = nil
    modelURL = nil
    log.info("[MLXBridge] Model unloaded")
  }
  
  public func createMultiArray(shape: [Int], dataType: MLMultiArrayDataType) throws -> MLMultiArray {
    let nsShape = shape.map { NSNumber(value: $0) }
    return try MLMultiArray(shape: nsShape, dataType: dataType)
  }
  
  public func prepareInput(tokenIds: [Int32], inputName: String = "input_ids") throws -> MLFeatureProvider {
    let shape = [1, tokenIds.count] as [NSNumber]
    let tokenArray = try MLMultiArray(shape: shape, dataType: .int32)
    
    for (index, tokenId) in tokenIds.enumerated() {
      tokenArray[[0, index] as [NSNumber]] = NSNumber(value: tokenId)
    }
    
    let featureValue = MLFeatureValue(multiArray: tokenArray)
    return try MLDictionaryFeatureProvider(dictionary: [inputName: featureValue])
  }
  
  public func extractLogits(from output: MLFeatureProvider, outputName: String = "logits") throws -> [Float] {
    guard let logitsFeature = output.featureValue(for: outputName),
          let logitsArray = logitsFeature.multiArrayValue else {
      throw NSError(domain: "MLXBridge", code: -2, userInfo: [
        NSLocalizedDescriptionKey: "Failed to extract logits from output"
      ])
    }
    
    var logits: [Float] = []
    let count = logitsArray.count
    logits.reserveCapacity(count)
    
    for i in 0..<count {
      logits.append(logitsArray[i].floatValue)
    }
    
    return logits
  }
  
  public func extractEmbedding(from output: MLFeatureProvider, embeddingKey: String? = nil) throws -> [Double] {
    let possibleKeys = embeddingKey.map { [$0] } ?? [
      "embedding",
      "hidden_states",
      "last_hidden_state",
      "pooler_output"
    ]
    
    for key in possibleKeys {
      if let feature = output.featureValue(for: key),
         let array = feature.multiArrayValue {
        var embedding: [Double] = []
        let count = min(array.count, 8192)
        
        for i in 0..<count {
          embedding.append(array[i].doubleValue)
        }
        
        return embedding
      }
    }
    
    throw NSError(domain: "MLXBridge", code: -3, userInfo: [
      NSLocalizedDescriptionKey: "Failed to extract embedding from output. Tried keys: \(possibleKeys.joined(separator: ", "))"
    ])
  }
  
  public func normalizeEmbedding(_ embedding: [Double]) -> [Double] {
    let magnitude = sqrt(embedding.reduce(0) { $0 + $1 * $1 })
    guard magnitude > 0 else { return embedding }
    return embedding.map { $0 / magnitude }
  }
  
  public func poolEmbeddings(_ embeddings: [[Double]], method: String = "mean") -> [Double] {
    guard !embeddings.isEmpty else { return [] }
    
    let dimension = embeddings[0].count
    var pooled = Array(repeating: 0.0, count: dimension)
    
    switch method {
    case "mean":
      for embedding in embeddings {
        for (i, value) in embedding.enumerated() {
          pooled[i] += value
        }
      }
      let count = Double(embeddings.count)
      pooled = pooled.map { $0 / count }
      
    case "max":
      for i in 0..<dimension {
        let maxValue = embeddings.map { $0[i] }.max() ?? 0
        pooled[i] = maxValue
      }
      
    case "cls":
      pooled = embeddings.first ?? []
      
    default:
      pooled = embeddings.first ?? []
    }
    
    return pooled
  }
}
