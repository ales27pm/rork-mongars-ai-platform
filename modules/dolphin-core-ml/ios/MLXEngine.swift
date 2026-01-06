import Foundation
import Hub
import MLX
import MLXLLM
import MLXLMCommon
import MLXNN
import MLXRandom
import Tokenizers
import os

@available(iOS 18.0, *)
public actor MLXEngine {
  public struct Configuration: Equatable {
    public let modelId: String
    public let revision: String
    public let tokenizerId: String?
    public let localModelPath: String?
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
      maxCacheEntries: Int = 128,
      modelId: String = "mlx-community/lille-130m",
      revision: String = "main",
      tokenizerId: String? = nil,
      localModelPath: String? = nil
    ) {
      self.modelId = modelId
      self.revision = revision
      self.tokenizerId = tokenizerId
      self.localModelPath = localModelPath
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
        "maxCacheEntries": maxCacheEntries,
        "modelId": modelId,
        "revision": revision,
        "tokenizerId": tokenizerId as Any,
        "localModelPath": localModelPath as Any
      ]
    }
  }

  private let log = Logger(subsystem: "app.27pm.mongars", category: "MLXEngine")

  private var configuration = Configuration()
  private var isReady = false
  private var modelContext: ModelContext?
  private var tokenizer: Tokenizer?
  private var generationCache: [KVCache] = []
  private var tokenCache: [String: [Int]] = [:]
  private var tokenCacheOrder: [String] = []

  public init() {}

  public func initialize(config: Configuration = Configuration()) async throws -> [String: Any] {
    try validate(config: config)
    configuration = config
    MLXRandom.seed(config.seed)
    let hub = HubApi()
    let identifier: ModelConfiguration.Identifier
    if let localPath = config.localModelPath, !localPath.isEmpty {
      identifier = .directory(URL(fileURLWithPath: localPath, isDirectory: true))
    } else {
      identifier = .id(config.modelId, revision: config.revision)
    }

    let modelConfiguration = ModelConfiguration(
      id: identifier,
      tokenizerId: config.tokenizerId,
      overrideTokenizer: nil,
      defaultPrompt: "",
      extraEOSTokens: []
    )

    let factory = ModelFactory(registry: LLMRegistry.shared)
    let loadedContext = try await factory.load(
      hub: hub,
      configuration: modelConfiguration
    )

    modelContext = loadedContext
    tokenizer = loadedContext.tokenizer
    generationCache = []
    isReady = true
    resetCache()

    log.info(
      "[MLXEngine] Initialized with model=\(config.modelId) revision=\(config.revision) tokenizer=\(config.tokenizerId ?? config.modelId)")

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
    guard isReady, let context = modelContext else {
      throw NSError(domain: "MLXEngine", code: -1, userInfo: [NSLocalizedDescriptionKey: "MLX engine not initialized"])
    }

    let normalize = options["normalize"] as? Bool ?? true
    let targetDim = options["dimension"] as? Int ?? configuration.hiddenSize
    var results: [[Double]] = []
    results.reserveCapacity(texts.count)

    for text in texts {
      let userInput = UserInput(prompt: text)
      let lmInput = try await context.processor.prepare(input: userInput)
      var cache = context.model.newCache(parameters: nil)
      let prepared = try context.model.prepare(
        lmInput,
        cache: cache,
        windowSize: configuration.contextLength
      )

      let output: LMOutput
      switch prepared {
      case .logits(let logits):
        output = logits
      case .tokens(let tokens):
        output = context.model(tokens, cache: cache)
      }

      let pooled = output.logits.mean(axis: 0, keepDims: false)
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
    guard isReady, let context = modelContext else {
      throw NSError(domain: "MLXEngine", code: -1, userInfo: [NSLocalizedDescriptionKey: "MLX engine not initialized"])
    }

    let parameters = GenerateParameters(
      maxTokens: maxTokens,
      temperature: temperature,
      topP: 1.0,
      repetitionPenalty: nil,
      repetitionContextSize: 128
    )

    let userInput = UserInput(prompt: prompt)
    let lmInput = try await context.processor.prepare(input: userInput)

    if generationCache.isEmpty {
      generationCache = context.model.newCache(parameters: parameters)
    }

    let result = try MLXLMCommon.generate(
      input: lmInput,
      cache: generationCache,
      parameters: parameters,
      context: context
    ) { _ in .more }

    return result.output
  }

  private func tokenize(_ text: String) -> [Int] {
    let sanitized = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if let cached = tokenCache[sanitized] {
      return cached
    }

    guard !sanitized.isEmpty, let tokenizer else { return [0] }

    do {
      let encoding = try tokenizer.encode(sanitized)
      let ids = encoding.ids.map { Int($0) }
      cache(tokens: ids, for: sanitized)
      return ids
    } catch {
      log.error("[MLXEngine] Failed to tokenize input: \(error.localizedDescription)")
      return [0]
    }
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

    if config.modelId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      && (config.localModelPath ?? "").isEmpty
    {
      throw NSError(domain: "MLXEngine", code: -102, userInfo: [
        NSLocalizedDescriptionKey: "A modelId or localModelPath is required for MLX engine"
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
