// DolphinCoreML module disabled for production builds
// The native module requires additional setup for CoreML/MLX integration
const withMLXPods = (config) => {
  // No-op: DolphinCoreML pod is not added to avoid build failures
  return config;
};

module.exports = withMLXPods;
