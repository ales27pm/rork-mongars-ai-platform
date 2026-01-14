import Foundation

class Tokenizer {
  private let model: SentencePieceModel

  init(modelPath: String) throws {
    self.model = try SentencePieceModel(path: modelPath)
  }

  func encode(_ text: String) -> [Int] {
    return model.encode(text)
  }

  func decode(_ tokens: [Int]) -> String {
    return model.decode(tokens)
  }
}

// Minimal SentencePiece wrapper (native, not JS)
class SentencePieceModel {
  private let spm: OpaquePointer

  init(path: String) throws {
    guard let ptr = spm_load(path) else { throw NSError(domain: "Tokenizer", code: 1, userInfo: nil) }
    self.spm = ptr
  }

  deinit { spm_free(spm) }

  func encode(_ text: String) -> [Int] {
    var out: [Int32] = []
    let count = spm_encode(spm, text, &out)
    return out.prefix(Int(count)).map { Int($0) }
  }

  func decode(_ tokens: [Int]) -> String {
    var out = [UInt8](repeating: 0, count: 4096)
    let count = spm_decode(spm, tokens.map { Int32($0) }, Int32(tokens.count), &out)
    return String(bytes: out.prefix(Int(count)), encoding: .utf8) ?? ""
  }
}

// Native C bridging
@_silgen_name("spm_load") func spm_load(_ path: UnsafePointer<CChar>) -> OpaquePointer?
@_silgen_name("spm_free") func spm_free(_ ptr: OpaquePointer)
@_silgen_name("spm_encode") func spm_encode(_ ptr: OpaquePointer, _ text: UnsafePointer<CChar>, _ out: UnsafeMutablePointer<Int32>) -> Int32
@_silgen_name("spm_decode") func spm_decode(_ ptr: OpaquePointer, _ tokens: UnsafePointer<Int32>, _ count: Int32, _ out: UnsafeMutablePointer<UInt8>) -> Int32
