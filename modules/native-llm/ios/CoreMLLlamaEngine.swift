import Foundation
import CoreML
import Metal

class CoreMLLlamaEngine {
  private let model: MLModel
  private let tokenizer: Tokenizer
  private var activeTasks: [String: Task<Void, Never>] = [:]

  init(modelPath: String) throws {
    let config = MLModelConfiguration()
    config.computeUnits = .cpuAndGPU
    let url = URL(fileURLWithPath: modelPath)
    self.model = try MLModel(contentsOf: url, configuration: config)
    self.tokenizer = try Tokenizer(modelPath: modelPath + "/tokenizer.model")
  }

  func generate(requestId: String, prompt: String, maxTokens: Int, temperature: Double, topK: Int, seed: Int, onToken: @escaping (String, String) -> Void, onDone: @escaping (String, String, Int, Int) -> Void, onError: @escaping (String, String) -> Void) {
    let task = Task {
      do {
        var tokens = tokenizer.encode(prompt)
        var output = ""
        var state: MLMultiArray? = nil
        let start = Date()
        for i in 0..<maxTokens {
          if Task.isCancelled { onError(requestId, "Cancelled"); return }
          let input = try prepareInput(tokens: tokens, state: state)
          let prediction = try model.prediction(from: input)
          let logits = extractLogits(prediction: prediction)
          let nextToken = sampleToken(logits: logits, temperature: temperature, topK: topK, seed: seed)
          tokens.append(nextToken)
          let tokenStr = tokenizer.decode([nextToken])
          output += tokenStr
          onToken(requestId, tokenStr)
          state = extractState(prediction: prediction)
        }
        let ms = Int(Date().timeIntervalSince(start) * 1000)
        onDone(requestId, output, tokens.count, ms)
      } catch {
        onError(requestId, error.localizedDescription)
      }
    }
    activeTasks[requestId] = task
  }

  func stop(requestId: String) {
    activeTasks[requestId]?.cancel()
    activeTasks.removeValue(forKey: requestId)
  }

  private func prepareInput(tokens: [Int], state: MLMultiArray?) throws -> MLFeatureProvider {
    // Adapt to model's input names
    // Example: "input_ids", "state"
    let inputIds = try MLMultiArray(shape: [tokens.count as NSNumber], dataType: .int32)
    for (i, t) in tokens.enumerated() { inputIds[i] = NSNumber(value: t) }
    var dict: [String: Any] = ["input_ids": inputIds]
    if let state = state { dict["state"] = state }
    return try MLDictionaryFeatureProvider(dictionary: dict)
  }

  private func extractLogits(prediction: MLFeatureProvider) -> [Float] {
    // Adapt to model's output names
    let logitsArray = prediction.featureValue(for: "logits")?.multiArrayValue
    guard let logits = logitsArray else { return [] }
    return (0..<logits.count).map { Float(truncating: logits[$0]) }
  }

  private func sampleToken(logits: [Float], temperature: Double, topK: Int, seed: Int) -> Int {
    // TopK + temperature sampling
    let sorted = logits.enumerated().sorted { $0.element > $1.element }
    let candidates = Array(sorted.prefix(topK))
    let probs = candidates.map { exp($0.element / Float(temperature)) }
    let sum = probs.reduce(0, +)
    let norm = probs.map { $0 / sum }
    let idx = categoricalSample(norm, seed: seed)
    return candidates[idx].offset
  }

  private func categoricalSample(_ probs: [Float], seed: Int) -> Int {
    var rng = seed == 0 ? SystemRandomNumberGenerator() : SeededGenerator(seed: seed)
    let r = Float.random(in: 0..<1, using: &rng)
    var acc: Float = 0
    for (i, p) in probs.enumerated() {
      acc += p
      if r < acc { return i }
    }
    return probs.count - 1
  }

  private func extractState(prediction: MLFeatureProvider) -> MLMultiArray? {
    return prediction.featureValue(for: "state")?.multiArrayValue
  }
}

struct SeededGenerator: RandomNumberGenerator {
  private var state: UInt64
  init(seed: Int) { self.state = UInt64(seed) }
  mutating func next() -> UInt64 {
    state = state &* 6364136223846793005 &+ 1
    return state
  }
}
