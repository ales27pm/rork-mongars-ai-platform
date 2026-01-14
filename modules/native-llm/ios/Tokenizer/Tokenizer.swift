import Foundation
import Tokenizers
import os

class Tokenizer {
  private let tokenizer: any Tokenizers.Tokenizer
  private let logger = Logger(subsystem: "com.rork.native-llm", category: "Tokenizer")

  init(modelFolder: String) async throws {
    let folderURL = URL(fileURLWithPath: modelFolder, isDirectory: true)
    let tokenizerURL = folderURL.appendingPathComponent("tokenizer.json")
    guard FileManager.default.fileExists(atPath: tokenizerURL.path) else {
      logger.error("Tokenizer JSON missing at \(tokenizerURL.path, privacy: .public)")
      throw NSError(
        domain: "Tokenizer",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Missing tokenizer.json at \(tokenizerURL.path)"]
      )
    }
    do {
      tokenizer = try await AutoTokenizer.from(modelFolder: folderURL)
    } catch {
      logger.error("Tokenizer load failed: \(error.localizedDescription, privacy: .public)")
      throw error
    }
  }

  func encode(_ text: String) -> [Int] {
    tokenizer.encode(text: text)
  }

  func decode(_ tokens: [Int]) -> String {
    tokenizer.decode(tokens: tokens)
  }
}
