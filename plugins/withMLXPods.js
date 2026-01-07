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
  'spm_pkg "mlx-swift", :url => "https://github.com/ml-explore/mlx-swift", :branch => "main"',
  'spm_pkg "mlx-swift-examples", :url => "https://github.com/ml-explore/mlx-swift-examples", :branch => "main"',
];

const ensureMLXPods = (podfile) => {
  const hasAllSpmLines = SPM_LINES.every((line) => podfile.includes(line));
  const hasRequireBlock = podfile.includes("require 'cocoapods-spm'");
  if (hasRequireBlock && podfile.includes(PLUGIN_LINE) && hasAllSpmLines) {
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

  const podsBlock = `if defined?(spm_pkg)\n${SPM_LINES.join("\n")}\nend`;
  const hasSpmBlockAlready =
    SPM_LINES.some((line) => updatedPodfile.includes(line)) ||
    updatedPodfile.includes('spm_pkg "mlx-swift"');

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
