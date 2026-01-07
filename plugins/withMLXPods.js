const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const REQUIRE_LINE = "require 'cocoapods-spm'";
const PLUGIN_LINE = "plugin 'cocoapods-spm'";
const SPM_LINES = [
  'spm_pkg "mlx-swift", :url => "https://github.com/ml-explore/mlx-swift", :branch => "main"',
  'spm_pkg "mlx-swift-examples", :url => "https://github.com/ml-explore/mlx-swift-examples", :branch => "main"',
];

const ensureMLXPods = (podfile) => {
  const hasAllSpmLines = SPM_LINES.every((line) => podfile.includes(line));
  if (
    podfile.includes(REQUIRE_LINE) &&
    podfile.includes(PLUGIN_LINE) &&
    hasAllSpmLines
  ) {
    return podfile;
  }

  let updatedPodfile = podfile;
  if (!updatedPodfile.includes(REQUIRE_LINE)) {
    updatedPodfile = `${REQUIRE_LINE}\n${updatedPodfile}`;
  }
  if (!updatedPodfile.includes(PLUGIN_LINE)) {
    const requireIndex = updatedPodfile.indexOf(REQUIRE_LINE);
    if (requireIndex !== -1) {
      const insertAt = requireIndex + REQUIRE_LINE.length;
      updatedPodfile = `${updatedPodfile.slice(0, insertAt)}\n${PLUGIN_LINE}${updatedPodfile.slice(insertAt)}`;
    } else {
      updatedPodfile = `${PLUGIN_LINE}\n${updatedPodfile}`;
    }
  }

  const podsBlock = SPM_LINES.join("\n");
  if (podfile.includes("use_expo_modules!")) {
    return updatedPodfile.replace(
      "use_expo_modules!",
      `use_expo_modules!\n${podsBlock}`,
    );
  }

  if (podfile.includes("use_react_native!")) {
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
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      const podfilePath = path.join(iosRoot, "Podfile");

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withMLXPods] Podfile not found, skipping MLX pods.");
        return config;
      }

      const podfile = fs.readFileSync(podfilePath, "utf8");
      const updated = ensureMLXPods(podfile);

      if (updated !== podfile) {
        fs.writeFileSync(podfilePath, updated);
        console.log("[withMLXPods] Added MLX pods to Podfile");
      } else {
        console.log("[withMLXPods] MLX pods already present");
      }

      return config;
    },
  ]);
};

module.exports = withMLXPods;
