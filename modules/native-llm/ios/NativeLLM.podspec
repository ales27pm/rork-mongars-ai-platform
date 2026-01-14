require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))

Pod::Spec.new do |s|
  s.name = "NativeLLM"
  s.version = package["version"] || "0.0.1"
  s.summary = "Native LLM native module"
  s.description = "Native Expo module providing LLM integration."
  s.homepage = "https://example.invalid/native-llm"
  s.license = { type: "UNLICENSED" }
  s.author = { "monGARS" => "dev@example.invalid" }
  s.platforms = { ios: "15.0" }
  s.source = { path: "." }
  s.source_files = "*.swift", "Tokenizer/**/*.swift"
  s.requires_arc = true
  s.static_framework = true
  s.swift_version = "5.9"
  s.dependency "ExpoModulesCore"
  s.send(:spm_dependency, "swift-transformers/Tokenizers")
end
