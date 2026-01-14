
import Foundation
import CoreML
import React

@objc(NativeLLMModule)
class NativeLLMModule: NSObject, RCTBridgeModule {
  static func moduleName() -> String! { "native-llm" }
  static func requiresMainQueueSetup() -> Bool { false }

  private var engine: CoreMLLlamaEngine?

  @objc(loadModel:resolver:rejecter:)
  func loadModel(params: NSDictionary, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    guard let modelPath = params["modelPath"] as? String else {
      rejecter("LOAD_ERROR", "Missing modelPath", nil)
      return
    }
    do {
      engine = try CoreMLLlamaEngine(modelPath: modelPath)
      resolver(["ok": true, "engine": "coreml"])
    } catch {
      rejecter("LOAD_ERROR", "Failed to load model", error)
    }
  }

  @objc(generate:resolver:rejecter:)
  func generate(params: NSDictionary, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard let engine = engine else {
      rejecter("GEN_ERROR", "Model not loaded", nil)
      return
    }
    let prompt = params["prompt"] as? String ?? ""
    let maxTokens = params["maxTokens"] as? Int ?? 128
    let temperature = params["temperature"] as? Double ?? 0.8
    let topK = params["topK"] as? Int ?? 40
    let seed = params["seed"] as? Int ?? 0
    let requestId = UUID().uuidString
    engine.generate(requestId: requestId, prompt: prompt, maxTokens: maxTokens, temperature: temperature, topK: topK, seed: seed, onToken: { reqId, token in
      self.sendEvent(["type": "token", "requestId": reqId, "token": token])
    }, onDone: { reqId, output, tokens, ms in
      self.sendEvent(["type": "done", "requestId": reqId, "output": output, "tokens": tokens, "ms": ms])
      resolver(["requestId": reqId])
    }, onError: { reqId, message in
      self.sendEvent(["type": "error", "requestId": reqId, "message": message])
      rejecter("GEN_ERROR", message, nil)
    })
  }

  @objc(stop:resolver:rejecter:)
  func stop(requestId: String, resolver: RCTPromiseResolveBlock, rejecter: RCTPromiseRejectBlock) {
    engine?.stop(requestId: requestId)
    resolver(["ok": true])
  }

  @objc(status:)
  func status(resolver: RCTPromiseResolveBlock) {
    let loaded = engine != nil
    resolver(["loaded": loaded, "engine": "coreml", "version": "coreml-native"])
  }

  @objc(health:)
  func health(resolver: RCTPromiseResolveBlock) {
    resolver(["ok": true, "details": "Native LLM healthy"])
  }

  private func sendEvent(_ body: [String: Any]) {
    if let bridge = self.value(forKey: "bridge") as? RCTBridge,
       let eventEmitter = bridge.module(for: RCTEventEmitter.self) as? RCTEventEmitter {
      eventEmitter.sendEvent(withName: "NativeLLMEvent", body: body)
    }
  }
}
