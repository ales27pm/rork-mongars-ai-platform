
import Foundation
import CoreML
import ExpoModulesCore
import os

public class NativeLLMModule: Module {
  private let logger = Logger(subsystem: "com.rork.native-llm", category: "NativeLLM")
  private var engine: CoreMLLlamaEngine?

  public func definition() -> ModuleDefinition {
    Name("native-llm")
    Events("llmEvent")

    AsyncFunction("loadModel") { (params: [String: Any]) throws -> [String: Any] in
      guard let modelPath = params["modelPath"] as? String else {
        self.logger.error("Load failed: missing modelPath")
        throw NSError(domain: "NativeLLM", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing modelPath"])
      }
      do {
        self.engine = try CoreMLLlamaEngine(modelPath: modelPath)
        self.logger.info("Loaded CoreML model at \(modelPath, privacy: .private)")
        return ["ok": true, "engine": "coreml"]
      } catch {
        self.logger.error("Load failed: \(error.localizedDescription, privacy: .public)")
        throw error
      }
    }

    AsyncFunction("unloadModel") { () -> [String: Any] in
      self.engine = nil
      self.logger.info("Unloaded CoreML model")
      return ["ok": true]
    }

    AsyncFunction("generate") { (params: [String: Any]) throws -> [String: Any] in
      guard let engine = self.engine else {
        self.logger.error("Generate failed: model not loaded")
        throw NSError(domain: "NativeLLM", code: 2, userInfo: [NSLocalizedDescriptionKey: "Model not loaded"])
      }
      let prompt = params["prompt"] as? String ?? ""
      let maxTokens = params["maxTokens"] as? Int ?? 128
      let temperature = params["temperature"] as? Double ?? 0.8
      let topK = params["topK"] as? Int ?? 40
      let seed = params["seed"] as? Int ?? 0
      let requestId = UUID().uuidString
      engine.generate(
        requestId: requestId,
        prompt: prompt,
        maxTokens: maxTokens,
        temperature: temperature,
        topK: topK,
        seed: seed,
        onToken: { reqId, token in
          self.sendEvent("llmEvent", [
            "type": "token",
            "requestId": reqId,
            "token": token,
          ])
        },
        onDone: { reqId, output, tokens, ms in
          self.sendEvent("llmEvent", [
            "type": "done",
            "requestId": reqId,
            "output": output,
            "tokens": tokens,
            "ms": ms,
          ])
        },
        onError: { reqId, message in
          self.sendEvent("llmEvent", [
            "type": "error",
            "requestId": reqId,
            "message": message,
          ])
        }
      )
      return ["requestId": requestId]
    }

    AsyncFunction("stop") { (requestId: String) -> [String: Any] in
      self.engine?.stop(requestId: requestId)
      self.logger.info("Stopped generation for \(requestId, privacy: .private)")
      return ["ok": true]
    }

    AsyncFunction("status") { () -> [String: Any] in
      let loaded = self.engine != nil
      return ["loaded": loaded, "engine": "coreml", "version": "coreml-native"]
    }

    AsyncFunction("health") { () -> [String: Any] in
      return ["ok": true, "details": "Native LLM healthy"]
    }

    AsyncFunction("embed") { (_ text: String) throws -> [String: Any] in
      self.logger.error("Embeddings are not supported on iOS CoreML engine")
      throw NSError(
        domain: "NativeLLM",
        code: 3,
        userInfo: [NSLocalizedDescriptionKey: "Embeddings are not supported on iOS CoreML engine"]
      )
    }
  }
}
