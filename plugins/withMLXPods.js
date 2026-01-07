const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const POD_LINES = [
  "  pod 'MLX', :git => 'https://github.com/ml-explore/mlx-swift', :branch => 'main'",
  "  pod 'MLXLLM', :git => 'https://github.com/ml-explore/mlx-swift-examples', :branch => 'main'",
  "  pod 'MLXLMCommon', :git => 'https://github.com/ml-explore/mlx-swift-examples', :branch => 'main'",
];

const ensureMLXPods = (podfile) => {
  if (POD_LINES.some((line) => podfile.includes(line))) {
    return podfile;
  }

  const podsBlock = POD_LINES.join("\n");
  if (podfile.includes("use_expo_modules!")) {
    return podfile.replace(
      "use_expo_modules!",
      `use_expo_modules!\n${podsBlock}`,
    );
  }

  if (podfile.includes("use_react_native!")) {
    return podfile.replace(
      "use_react_native!",
      `use_react_native!\n${podsBlock}`,
    );
  }

  return podfile.replace(/target ['"].+?['"] do/, (match) => {
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
