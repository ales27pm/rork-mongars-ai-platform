const { withPodfile, withXcodeProject } = require("@expo/config-plugins");

const SPM_PLUGIN = "plugin 'cocoapods-spm'";
const SPM_PKG =
  "spm_pkg 'mlx-swift', :git => 'https://github.com/ml-explore/mlx-swift.git', :tag => '0.24.0'";

const SPM_FILELIST_GUARD = [
  "  # Work around cocoapods-spm expecting resource xcfilelist files in CI.",
  "  # Also disable Xcode Explicit Modules for CocoaPods targets (Xcode 16+/26 can emit stale -fmodule-map-file flags).",
  "  require 'fileutils'",
  "  explicit_module_keys = %w[",
  "    SWIFT_ENABLE_EXPLICIT_MODULES",
  "    _EXPERIMENTAL_SWIFT_EXPLICIT_MODULES",
  "    CLANG_ENABLE_EXPLICIT_MODULES",
  "    _EXPERIMENTAL_CLANG_EXPLICIT_MODULES",
  "    ENABLE_EXPLICIT_MODULES",
  "  ]",
  "  disable_explicit_modules = lambda do |settings|",
  "    explicit_module_keys.each do |k|",
  "      settings[k] = 'NO'",
  "    end",
  "  end",
  "  strip_modulemap_flags = lambda do |value|",
  "    s = value.to_s",
  "    return value unless s.include?('Cmlx.modulemap')",
  "    scrubbed = s",
  "      .gsub(/-fmodule-map-file(?:=|\\s+)(?:\\\"|')?[^\\s\\\"']*Cmlx\\.modulemap[^\\s\\\"']*(?:\\\"|')?/, '')",
  "      .gsub(/\\s+/, ' ')",
  "      .strip",
  "    scrubbed.empty? ? nil : scrubbed",
  "  end",
  "  scrub_build_settings = lambda do |settings|",
  "    disable_explicit_modules.call(settings)",
  "    settings.keys.each do |key|",
  "      next unless settings[key].is_a?(String)",
  "      if settings[key].include?('Cmlx.modulemap')",
  "        cleaned = strip_modulemap_flags.call(settings[key])",
  "        if cleaned.nil?",
  "          settings.delete(key)",
  "        else",
  "          settings[key] = cleaned",
  "        end",
  "      end",
  "    end",
  "    ['OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS', 'OTHER_SWIFT_FLAGS', 'OTHER_LDFLAGS'].each do |key|",
  "      next unless settings[key]",
  "      cleaned = strip_modulemap_flags.call(settings[key])",
  "      if cleaned.nil?",
  "        settings.delete(key)",
  "      else",
  "        settings[key] = cleaned",
  "      end",
  "    end",
  "    ['MODULEMAP_FILE', 'CLANG_MODULEMAP_FILE'].each do |key|",
  "      if settings[key].to_s.include?('Cmlx.modulemap')",
  "        settings.delete(key)",
  "      end",
  "    end",
  "  end",
  "  fix_xcfilelists = lambda do |aggregate_target|",
  "    support_dir = aggregate_target.support_files_dir.to_s",
  "    filelists = [",
  "      'SPMResourcesInputFiles.xcfilelist',",
  "      'SPMResourcesOutputFiles.xcfilelist',",
  "      'SPMScriptsInputFiles.xcfilelist',",
  "      'SPMScriptsOutputFiles.xcfilelist',",
  "    ]",
  "    filelists.each do |name|",
  "      path = File.join(support_dir, name)",
  "      next if File.exist?(path)",
  "      FileUtils.mkdir_p(File.dirname(path))",
  "      File.write(path, '')",
  "    end",
  "  end",
  "  installer.aggregate_targets.each do |aggregate_target|",
  "    fix_xcfilelists.call(aggregate_target)",
  "    if aggregate_target.respond_to?(:user_targets)",
  "      aggregate_target.user_targets.each do |user_target|",
  "        user_target.build_configurations.each do |config|",
  "          scrub_build_settings.call(config.build_settings)",
  "        end",
  "      end",
  "    end",
  "    Dir.glob(File.join(aggregate_target.support_files_dir, '*.xcconfig')).each do |xcconfig_path|",
  "      next unless File.exist?(xcconfig_path)",
  "      contents = File.read(xcconfig_path)",
  "      next unless contents.include?('Cmlx.modulemap') || contents.include?('EXPLICIT_MODULES')",
  "      explicit_module_keys.each do |k|",
  '        contents = contents.gsub(/\\b#{Regexp.escape(k)}\\s*=\\s*YES\\b/, "#{k} = NO")',
  "      end",
  "      contents = contents.gsub(/-fmodule-map-file(?:=|\\s+)(?:\\\"|')?[^\\s\\\"']*Cmlx\\.modulemap[^\\s\\\"']*(?:\\\"|')?/, '')",
  "      contents = contents.gsub(/\\s+/, ' ')",
  "      File.write(xcconfig_path, contents)",
  "    end",
  "  end",
  "  installer.pods_project.targets.each do |target|",
  "    target.build_configurations.each do |config|",
  "      scrub_build_settings.call(config.build_settings)",
  "    end",
  "  end",
].join("\n");

const SPM_MODULEMAP_CLEANUP = [
  "post_integrate do |installer|",
  "  # Ensure modulemap cleanup runs after post_integrate hooks too.",
  "  # This is a second pass because some build settings/xcconfigs are generated after post_install.",
  "  require 'fileutils'",
  "  explicit_module_keys = %w[",
  "    SWIFT_ENABLE_EXPLICIT_MODULES",
  "    _EXPERIMENTAL_SWIFT_EXPLICIT_MODULES",
  "    CLANG_ENABLE_EXPLICIT_MODULES",
  "    _EXPERIMENTAL_CLANG_EXPLICIT_MODULES",
  "    ENABLE_EXPLICIT_MODULES",
  "  ]",
  "  disable_explicit_modules = lambda do |settings|",
  "    explicit_module_keys.each do |k|",
  "      settings[k] = 'NO'",
  "    end",
  "  end",
  "  strip_modulemap_flags = lambda do |value|",
  "    s = value.to_s",
  "    return value unless s.include?('Cmlx.modulemap')",
  "    scrubbed = s",
  "      .gsub(/-fmodule-map-file(?:=|\\s+)(?:\\\"|')?[^\\s\\\"']*Cmlx\\.modulemap[^\\s\\\"']*(?:\\\"|')?/, '')",
  "      .gsub(/\\s+/, ' ')",
  "      .strip",
  "    scrubbed.empty? ? nil : scrubbed",
  "  end",
  "  scrub_build_settings = lambda do |settings|",
  "    disable_explicit_modules.call(settings)",
  "    settings.keys.each do |key|",
  "      next unless settings[key].is_a?(String)",
  "      if settings[key].include?('Cmlx.modulemap')",
  "        cleaned = strip_modulemap_flags.call(settings[key])",
  "        if cleaned.nil?",
  "          settings.delete(key)",
  "        else",
  "          settings[key] = cleaned",
  "        end",
  "      end",
  "    end",
  "    ['OTHER_CFLAGS', 'OTHER_CPLUSPLUSFLAGS', 'OTHER_SWIFT_FLAGS', 'OTHER_LDFLAGS'].each do |key|",
  "      next unless settings[key]",
  "      cleaned = strip_modulemap_flags.call(settings[key])",
  "      if cleaned.nil?",
  "        settings.delete(key)",
  "      else",
  "        settings[key] = cleaned",
  "      end",
  "    end",
  "    ['MODULEMAP_FILE', 'CLANG_MODULEMAP_FILE'].each do |key|",
  "      if settings[key].to_s.include?('Cmlx.modulemap')",
  "        settings.delete(key)",
  "      end",
  "    end",
  "  end",
  "  installer.aggregate_targets.each do |aggregate_target|",
  "    Dir.glob(File.join(aggregate_target.support_files_dir, '*.xcconfig')).each do |xcconfig_path|",
  "      next unless File.exist?(xcconfig_path)",
  "      contents = File.read(xcconfig_path)",
  "      next unless contents.include?('Cmlx.modulemap') || contents.include?('EXPLICIT_MODULES')",
  "      explicit_module_keys.each do |k|",
  '        contents = contents.gsub(/\\b#{Regexp.escape(k)}\\s*=\\s*YES\\b/, "#{k} = NO")',
  "      end",
  "      contents = contents.gsub(/-fmodule-map-file(?:=|\\s+)(?:\\\"|')?[^\\s\\\"']*Cmlx\\.modulemap[^\\s\\\"']*(?:\\\"|')?/, '')",
  "      contents = contents.gsub(/\\s+/, ' ')",
  "      File.write(xcconfig_path, contents)",
  "    end",
  "  end",
  "  installer.pods_project.targets.each do |target|",
  "    target.build_configurations.each do |config|",
  "      scrub_build_settings.call(config.build_settings)",
  "    end",
  "  end",
  "end",
].join("\n");

function injectAfterLine(podfile, regex, injection) {
  const match = podfile.match(regex);
  if (!match) return podfile;
  const idx = match.index + match[0].length;
  return podfile.slice(0, idx) + injection + podfile.slice(idx);
}

function injectBeforeLine(podfile, regex, injection) {
  const match = podfile.match(regex);
  if (!match) return podfile;
  const idx = match.index;
  return podfile.slice(0, idx) + injection + podfile.slice(idx);
}

function ensurePostInstallBlock(podfile) {
  if (/post_install do \|installer\|/.test(podfile)) return podfile;

  // If there's already a post_integrate, we still want post_install.
  // Add at the bottom.
  return (
    podfile.trimEnd() +
    "\n\npost_install do |installer|\n" +
    "  # Added by withMLXPods\n" +
    "end\n"
  );
}

function ensureMLXPods(podfile) {
  let updated = podfile;

  updated = updated.replace(/^spm_pkg.*mlx-swift.*$/gm, SPM_PKG);

  // Ensure cocoapods-spm plugin line exists (near the top is fine).
  if (!updated.includes(SPM_PLUGIN)) {
    updated = `${SPM_PLUGIN}\n${updated}`;
  }

  // Ensure the MLX SPM package declaration exists.
  if (!updated.includes(SPM_PKG)) {
    // Place after plugin line if possible.
    if (updated.includes(SPM_PLUGIN)) {
      updated = updated.replace(SPM_PLUGIN, `${SPM_PLUGIN}\n${SPM_PKG}`);
    } else {
      updated = `${SPM_PKG}\n${updated}`;
    }
  }

  updated = ensurePostInstallBlock(updated);

  // Add filelist guard + modulemap scrub inside post_install.
  if (!updated.includes("fix_xcfilelists = lambda")) {
    updated = injectAfterLine(
      updated,
      /post_install do \|installer\|\n/,
      `${SPM_FILELIST_GUARD}\n`,
    );
  }

  // Add post_integrate cleanup (second pass).
  if (!updated.includes("post_integrate do |installer|")) {
    // Append at end of file.
    updated = `${updated.trimEnd()}\n\n${SPM_MODULEMAP_CLEANUP}\n`;
  }

  return updated;
}

const EXPLICIT_MODULE_KEYS = [
  "SWIFT_ENABLE_EXPLICIT_MODULES",
  "_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES",
  "CLANG_ENABLE_EXPLICIT_MODULES",
  "_EXPERIMENTAL_CLANG_EXPLICIT_MODULES",
  "ENABLE_EXPLICIT_MODULES",
];

const withExplicitModulesDisabledInXcodeProject = (config) => {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const configs = project.pbxXCBuildConfigurationSection();
    Object.keys(configs).forEach((key) => {
      const cfg = configs[key];
      if (!cfg || cfg.isa !== "XCBuildConfiguration") return;
      cfg.buildSettings = cfg.buildSettings || {};
      EXPLICIT_MODULE_KEYS.forEach((k) => {
        cfg.buildSettings[k] = "NO";
      });
    });
    return config;
  });
};

const withMLXPods = (config) => {
  const withPodfilePatched = withPodfile(config, (config) => {
    const podfile = config.modResults.contents;
    const updated = ensureMLXPods(podfile);

    if (updated !== podfile) {
      config.modResults.contents = updated;
      console.log(
        "[withMLXPods] Added/updated MLX SPM + modulemap guards in Podfile",
      );
    } else {
      console.log(
        "[withMLXPods] Podfile already contains MLX SPM + modulemap guards",
      );
    }

    return config;
  });

  // Extra belt-and-suspenders: disable explicit modules in the user Xcode project too.
  // (Pods are handled via post_install/post_integrate in the Podfile.)
  return withExplicitModulesDisabledInXcodeProject(withPodfilePatched);
};

module.exports = withMLXPods;
