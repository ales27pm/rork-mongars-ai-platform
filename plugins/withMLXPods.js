const withMLXPods = (config) => {
  // Podfile is maintained manually to ensure deterministic cocoapods-spm usage.
  // This plugin is intentionally a no-op to avoid injecting invalid Ruby.
  return config;
};

module.exports = withMLXPods;
