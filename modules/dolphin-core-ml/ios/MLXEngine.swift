import Foundation
import MLX
import MLXNN
import MLXRandom
import os

@available(iOS 18.0, *)
public actor MLXEngine {
  public struct Configuration: Equatable {
    public let vocabSize: Int
    public let contextLength: Int
    public let hiddenSize: Int
    public let heads: Int
    public let layers: Int
    public let seed: UInt64
    public let maxCacheEntries: Int

    public init(
      vocabSize: Int = 128_000,
      contextLength: Int = 512,
      hiddenSize: Int = 384,
      heads: Int = 6,
      layers: Int = 4,
      seed: UInt64 = 42,
      maxCacheEntries: Int = 128
    ) {
      self.vocabSize = vocabSize
      self.contextLength = contextLength
      self.hiddenSize = hiddenSize
      self.heads = heads
      self.layers = layers
      self.seed = seed
      self.maxCacheEntries = maxCacheEntries
    }

    public func asDictionary() -> [String: Any] {
      [
        "vocabSize": vocabSize,
        "contextLength": contextLength,
        "hiddenSize": hiddenSize,
        "heads": heads,
        "layers": layers,
        "seed": seed,
        "maxCacheEntries": maxCacheEntries
      ]
    }
  }

  private let log = Logger(subsystem: "app.27pm.mongars", category: "MLXEngine")

  private var configuration = Configuration()
  private var isReady = false
  private var tokenEmbedding: Embedding?
  private var positionEmbedding: Embedding?
  private var transformerBlocks: [MLXTransformerBlock] = []
  private var lmHead: Linear?
  private var tokenCache: [String: [Int]] = [:]
  private var tokenCacheOrder: [String] = []

  public init() {}

  public func initialize(config: Configuration = Configuration()) async throws -> [String: Any] {
    try validate(config: config)
    configuration = config
    MLXRandom.seed(config.seed)

    tokenEmbedding = Embedding(embeddingCount: config.vocabSize, dimensions: config.hiddenSize)
    positionEmbedding = Embedding(embeddingCount: config.contextLength, dimensions: config.hiddenSize)
    transformerBlocks = (0..<config.layers).map { _ in
      let block = MLXTransformerBlock(dimensions: config.hiddenSize, heads: config.heads)
      block.training = false
      return block
    }

    let head = Linear(config.hiddenSize, config.vocabSize, bias: false)
    head.training = false
    lmHead = head

    isReady = true
    resetCache()

    log.info("[MLXEngine] Initialized with vocabSize=\(config.vocabSize) hidden=\(config.hiddenSize) layers=\(config.layers) heads=\(config.heads)")

    return [
      "engine": "mlx",
      "configuration": config.asDictionary(),
      "message": "MLX engine ready"
    ]
  }

  public func encode(_ text: String, options: [String: Any] = [:]) async throws -> [Double] {
    let embeddings = try await encodeBatch([text], options: options)
    return embeddings.first ?? []
  }

  public func encodeBatch(_ texts: [String], options: [String: Any] = [:]) async throws -> [[Double]] {
    guard isReady, let tokenEmbedding, let positionEmbedding, let lmHead else {
      throw NSError(domain: "MLXEngine", code: -1, userInfo: [NSLocalizedDescriptionKey: "MLX engine not initialized"])
    }

    let normalize = options["normalize"] as? Bool ?? true
    let targetDim = options["dimension"] as? Int ?? configuration.hiddenSize
    var results: [[Double]] = []
    results.reserveCapacity(texts.count)

    for text in texts {
      let tokenIds = sanitize(tokens: tokenize(text))
      let positions = Array(0..<tokenIds.count)

      var hidden = tokenEmbedding(MLXArray(tokenIds)) + positionEmbedding(MLXArray(positions))
      hidden = expandedDimensions(hidden, axis: 0)

      let causalMask = MultiHeadAttention.createAdditiveCausalMask(tokenIds.count, dtype: hidden.dtype)

      for block in transformerBlocks {
        hidden = block(hidden, mask: causalMask)
      }

      // Project to logits and pool hidden states to obtain an embedding
      let decoderHidden = lmHead(hidden)
      let pooled = decoderHidden.mean(axis: 1, keepDims: false)
      let floatValues = pooled.asArray(Float.self)

      var doubleValues = floatValues.prefix(targetDim).map { Double($0) }

      if normalize {
        let norm = sqrt(doubleValues.reduce(0) { $0 + $1 * $1 })
        if norm > 0 {
          doubleValues = doubleValues.map { $0 / norm }
        }
      }

      results.append(doubleValues)
    }

    return results
  }

  public func generate(
    prompt: String,
    maxTokens: Int = 64,
    temperature: Float = 0.7,
    topK: Int = 40
  ) async throws -> String {
    guard isReady, let tokenEmbedding, let positionEmbedding, let lmHead else {
      throw NSError(domain: "MLXEngine", code: -1, userInfo: [NSLocalizedDescriptionKey: "MLX engine not initialized"])
    }

    var tokenIds = Array(sanitize(tokens: tokenize(prompt)).suffix(configuration.contextLength))
    var output = ""

    for iteration in 0..<maxTokens {
      let positions = Array(0..<tokenIds.count)
      var hidden = tokenEmbedding(MLXArray(Array(tokenIds))) + positionEmbedding(MLXArray(positions))
      hidden = expandedDimensions(hidden, axis: 0)
      let causalMask = MultiHeadAttention.createAdditiveCausalMask(tokenIds.count, dtype: hidden.dtype)

      for block in transformerBlocks {
        hidden = block(hidden, mask: causalMask)
      }

      let logits = lmHead(hidden)
      let lastLogits = logits[MLXArray([-1])]
      let nextToken = sampleToken(from: lastLogits, temperature: temperature, topK: topK)

      tokenIds.append(nextToken)
      let decoded = decode(tokenId: nextToken)
      output.append(decoded)

      log.debug("[MLXEngine] Generated token #\(iteration): \(decoded)")

      if tokenIds.count > configuration.contextLength {
        tokenIds = tokenIds.suffix(configuration.contextLength)
      }
    }

    return output
  }

  private func tokenize(_ text: String) -> [Int] {
    let sanitized = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if let cached = tokenCache[sanitized] {
      return cached
    }

    guard !sanitized.isEmpty else { return [0] }

    var tokens: [Int] = []
    let scalars = sanitized.unicodeScalars
    tokens.reserveCapacity(scalars.count + 1)
    tokens.append(1) // BOS token

    for scalar in scalars {
      let value = Int(scalar.value % UInt32(configuration.vocabSize))
      tokens.append(max(2, value))
    }

    tokens.append(2) // EOS token marker
    cache(tokens: tokens, for: sanitized)
    return tokens
  }

  private func sanitize(tokens: [Int]) -> [Int] {
    let limited = tokens.prefix(configuration.contextLength)
    return limited.map { max(0, min(configuration.vocabSize - 1, $0)) }
  }

  private func decode(tokenId: Int) -> String {
    if tokenId < 32 || tokenId > 126 {
      return ""
    }
    guard let scalar = UnicodeScalar(tokenId) else { return "" }
    return String(Character(scalar))
  }

  private func sampleToken(from logits: MLXArray, temperature: Float, topK: Int) -> Int {
    let scaled = logits / temperature
    let probabilities = softmax(scaled, axis: -1)
    let values = probabilities.asArray(Float.self)
    guard !values.isEmpty else { return 0 }

    let indexed = values.enumerated().sorted { $0.element > $1.element }
    let candidates = indexed.prefix(max(1, min(topK, indexed.count)))
    let sumTop = candidates.reduce(Float(0)) { $0 + $1.element }
    let normalized = candidates.map { ($0.offset, $0.element / max(sumTop, 1e-8)) }

    let threshold = Float.random(in: 0..<1)
    var cumulative: Float = 0
    for (index, prob) in normalized {
      cumulative += prob
      if threshold <= cumulative {
        return index
      }
    }

    return normalized.last?.0 ?? 0
  }

  private func validate(config: Configuration) throws {
    if config.vocabSize <= 0 || config.hiddenSize <= 0 || config.contextLength <= 0 || config.heads <= 0 || config.layers <= 0 {
      throw NSError(domain: "MLXEngine", code: -100, userInfo: [
        NSLocalizedDescriptionKey: "Invalid MLX configuration values"
      ])
    }

    if config.maxCacheEntries <= 0 {
      throw NSError(domain: "MLXEngine", code: -101, userInfo: [
        NSLocalizedDescriptionKey: "maxCacheEntries must be greater than zero"
      ])
    }
  }

  private func cache(tokens: [Int], for key: String) {
    tokenCache[key] = tokens
    tokenCacheOrder.removeAll(where: { $0 == key })
    tokenCacheOrder.append(key)

    if tokenCacheOrder.count > configuration.maxCacheEntries {
      if let evicted = tokenCacheOrder.first {
        tokenCache.removeValue(forKey: evicted)
        tokenCacheOrder.removeFirst()
      }
    }
  }

  private func resetCache() {
    tokenCache.removeAll()
    tokenCacheOrder.removeAll()
  }

  public func isReady(for config: Configuration) -> Bool {
    isReady && config == configuration
  }
}

@available(iOS 18.0, *)
final class MLXTransformerBlock: Module {
  @ModuleInfo(key: "attention") private var attention: MultiHeadAttention
  private let ln1: LayerNorm
  private let ln2: LayerNorm
  @ModuleInfo(key: "ffn1") private var ffn1: Linear
  @ModuleInfo(key: "ffn2") private var ffn2: Linear
  private let dropout: Dropout
  private let activation = GELU()

  init(dimensions: Int, heads: Int) {
    self._attention.wrappedValue = MultiHeadAttention(dimensions: dimensions, numHeads: heads)
    self.ln1 = LayerNorm(dimensions: dimensions)
    self.ln2 = LayerNorm(dimensions: dimensions)
    self.ffn1 = Linear(dimensions, dimensions * 4)
    self.ffn2 = Linear(dimensions * 4, dimensions)
    self.dropout = Dropout(p: 0.05)
    super.init()
    training = false
  }

  func callAsFunction(_ x: MLXArray, mask: MLXArray?) -> MLXArray {
    var hidden = ln1(x)
    if let mask {
      hidden = attention(hidden, keys: hidden, values: hidden, mask: mask)
    } else {
      hidden = attention(hidden, keys: hidden, values: hidden)
    }
    hidden = dropout(hidden)
    var residual = x + hidden

    var feedForward = ln2(residual)
    feedForward = activation(ffn1(feedForward))
    feedForward = dropout(feedForward)
    feedForward = ffn2(feedForward)

    residual = residual + feedForward
    return residual
  }
}
