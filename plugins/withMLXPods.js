const { withPodfile } = require("@expo/config-plugins");

const REQUIRE_BLOCK = [
  "begin",
  "  require 'cocoapods-spm'",
  "  plugin 'cocoapods-spm'",
  "rescue LoadError",
  "  Pod::UI.warn('[withMLXPods] cocoapods-spm gem not available, skipping MLX SPM integration')",
  "end",
].join("\n");
const PLUGIN_LINE = "plugin 'cocoapods-spm'";
const SPM_LINES = [
  'spm_pkg "mlx-swift", :git => "https://github.com/ml-explore/mlx-swift", :commit => "072b684acaae80b6a463abab3a103732f33774bf", :products => ["MLX", "MLXRandom", "MLXNN", "MLXOptimizers", "MLXFFT", "MLXLinalg", "MLXFast"]',
  'spm_pkg "mlx-swift-examples", :git => "https://github.com/ml-explore/mlx-swift-examples", :commit => "9bff95ca5f0b9e8c021acc4d71a2bbe4a7441631", :products => ["MLXLLM", "MLXVLM", "MLXLMCommon", "MLXMNIST", "MLXEmbedders", "StableDiffusion"]',
  'spm_pkg "swift-transformers", :git => "https://github.com/huggingface/swift-transformers", :version => "1.0.0", :products => ["Tokenizers", "Transformers"]',
];

const ensureMLXPods = (podfile) => {
  const hasAllSpmLines = SPM_LINES.every((line) => podfile.includes(line));
  const hasRequireBlock = podfile.includes("require 'cocoapods-spm'");
  const localPodLine = `pod 'DolphinCoreML', :path => '../modules/dolphin-core-ml/ios'`;
  const hasLocalPod = podfile.includes(localPodLine);
  if (
    hasRequireBlock &&
    podfile.includes(PLUGIN_LINE) &&
    hasAllSpmLines &&
    hasLocalPod
  ) {
    return podfile;
  }

  let updatedPodfile = podfile;
  if (!updatedPodfile.includes("require 'cocoapods-spm'")) {
    updatedPodfile = `${REQUIRE_BLOCK}\n${updatedPodfile}`;
  }
  if (!updatedPodfile.includes(PLUGIN_LINE)) {
    const requireIndex = updatedPodfile.indexOf("require 'cocoapods-spm'");
    if (requireIndex !== -1) {
      const insertAt = updatedPodfile.indexOf("\n", requireIndex);
      updatedPodfile = `${updatedPodfile.slice(0, insertAt + 1)}${PLUGIN_LINE}\n${updatedPodfile.slice(insertAt + 1)}`;
    } else {
      updatedPodfile = `${PLUGIN_LINE}\n${updatedPodfile}`;
    }
  }

  // Add SPM block
  const podsBlock = `if defined?(spm_pkg)\n${SPM_LINES.join("\n")}\nend`;
  const hasSpmBlockAlready =
    SPM_LINES.some((line) => updatedPodfile.includes(line)) ||
    updatedPodfile.includes('spm_pkg "mlx-swift"');

  // Add local pod for DolphinCoreML after use_expo_modules! or use_react_native!
  function addLocalPodBlock(str) {
    if (str.includes(localPodLine)) return str;
    const regex = /(use_expo_modules!|use_react_native!)/;
    if (regex.test(str)) {
      return str.replace(regex, `$1\n${localPodLine}`);
    }
    // fallback: add to top of file
    return `${localPodLine}\n${str}`;
  }

  updatedPodfile = addLocalPodBlock(updatedPodfile);

  if (!hasSpmBlockAlready && updatedPodfile.includes("use_expo_modules!")) {
    return updatedPodfile.replace(
      "use_expo_modules!",
      `use_expo_modules!\n${podsBlock}`,
    );
  }

  if (!hasSpmBlockAlready && updatedPodfile.includes("use_react_native!")) {
    return updatedPodfile.replace(
      "use_react_native!",
      `use_react_native!\n${podsBlock}`,
    );
  }

  return updatedPodfile.replace(/target ['"].+?['"] do/, (match) => {
    return `${match}\n${podsBlock}`;
  });
};

const withMLXPods = (config) => {
  // No-op: DolphinCoreML pod is not added to avoid build failures
  return config;
};

module.exports = withMLXPods;
