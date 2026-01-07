require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))

Pod::Spec.new do |s|
  s.name = "DolphinCoreML"
  s.version = package["version"]
  s.summary = "Dolphin Core ML native module"
  s.description = "Native Expo module providing Dolphin Core ML and MLX integration."
  s.homepage = "https://example.invalid/dolphin-core-ml"
  s.license = { type: "UNLICENSED" }
  s.author = { "monGARS" => "dev@example.invalid" }
  s.platforms = { ios: "18.0" }
  s.source = { git: "https://example.invalid/dolphin-core-ml.git", tag: s.version.to_s }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.requires_arc = true
  s.static_framework = true
  s.swift_version = "5.9"

  s.dependency "ExpoModulesCore"
end
