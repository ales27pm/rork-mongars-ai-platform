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
  'spm_pkg "swift-transformers", :git => "https://github.com/huggingface/swift-transformers", :version => "1.0.0", :products => ["Transformers"]',
];
const SPM_FILELIST_GUARD = [
  "  # Work around cocoapods-spm expecting resource xcfilelist files in CI.",
  "  require 'fileutils'",
  "  installer.aggregate_targets.each do |aggregate_target|",
  "    support_files_dir = aggregate_target.support_files_dir",
  "    FileUtils.mkdir_p(support_files_dir) unless File.directory?(support_files_dir)",
  "    build_configs = if aggregate_target.respond_to?(:build_configurations)",
  "      aggregate_target.build_configurations",
  "    elsif aggregate_target.respond_to?(:user_targets)",
  "      aggregate_target.user_targets.flat_map(&:build_configurations)",
  "    else",
  "      []",
  "    end",
  "    build_configs.each do |config|",
  "      ['input', 'output'].each do |filetype|",
  '        filelist = File.join(support_files_dir, "#{aggregate_target.name}-resources-#{config.name}-#{filetype}-files.xcfilelist")',
  "        File.write(filelist, '') unless File.exist?(filelist)",
  "      end",
  "    end",
  "  end",
  "  # Remove stale modulemap references that break archive builds.",
  "  installer.pods_project.targets.each do |target|",
  "    target.build_configurations.each do |config|",
  "      config_ref = config.base_configuration_reference",
  "      next unless config_ref",
  "      xcconfig_path = config_ref.real_path",
  "      next unless xcconfig_path && File.exist?(xcconfig_path)",
  "      xcconfig = File.read(xcconfig_path)",
  "      updated = xcconfig.gsub(/-fmodule-map-file=[^\\s]*Cmlx\\.modulemap\\s*/, '')",
  "      File.write(xcconfig_path, updated) if updated != xcconfig",
  "    end",
  "  end",
].join("\n");

const ensureMLXPods = (podfile) => {
  const hasAllSpmLines = SPM_LINES.every((line) => podfile.includes(line));
  const hasRequireBlock = podfile.includes("require 'cocoapods-spm'");
  if (hasRequireBlock && podfile.includes(PLUGIN_LINE) && hasAllSpmLines) {
    return ensureSpmFilelistGuard(podfile);
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

  const podsBlock = `if defined?(spm_pkg)\n${SPM_LINES.join("\n")}\nend`;
  const hasSpmBlockAlready =
    SPM_LINES.some((line) => updatedPodfile.includes(line)) ||
    updatedPodfile.includes('spm_pkg "mlx-swift"');

  if (!hasSpmBlockAlready && updatedPodfile.includes("use_expo_modules!")) {
    const updatedWithPods = updatedPodfile.replace(
      "use_expo_modules!",
      `use_expo_modules!\n${podsBlock}`,
    );
    return ensureSpmFilelistGuard(updatedWithPods);
  }

  if (!hasSpmBlockAlready && updatedPodfile.includes("use_react_native!")) {
    const updatedWithPods = updatedPodfile.replace(
      "use_react_native!",
      `use_react_native!\n${podsBlock}`,
    );
    return ensureSpmFilelistGuard(updatedWithPods);
  }

  const updatedWithPods = updatedPodfile.replace(
    /target ['"].+?['"] do/,
    (match) => {
      return `${match}\n${podsBlock}`;
    },
  );

  return ensureSpmFilelistGuard(updatedWithPods);
};

const ensureSpmFilelistGuard = (podfile) => {
  if (podfile.includes("cocoapods-spm expecting resource xcfilelist")) {
    return podfile;
  }

  if (podfile.includes("post_install do |installer|")) {
    return podfile.replace(
      "post_install do |installer|",
      `post_install do |installer|\n${SPM_FILELIST_GUARD}`,
    );
  }

  return `${podfile}\n\npost_install do |installer|\n${SPM_FILELIST_GUARD}\nend\n`;
};

const withMLXPods = (config) => {
  return withPodfile(config, (config) => {
    const podfile = config.modResults.contents;
    const updated = ensureMLXPods(podfile);

    if (updated !== podfile) {
      config.modResults.contents = updated;
      console.log("[withMLXPods] Added MLX pods to Podfile");
    } else {
      console.log("[withMLXPods] MLX pods already present");
    }

    return config;
  });
};

module.exports = withMLXPods;
