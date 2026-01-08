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
  "  # Xcode 26+ can enable 'Explicitly Built Modules' (SWIFT_ENABLE_EXPLICIT_MODULES)",
  "  # which may cause archive builds to fail when some generated clang module maps",
  "  # are missing (e.g. GeneratedModuleMaps-iphoneos/Cmlx.modulemap).",
  "  # Force it off for Pods + user targets as a pragmatic CI workaround.",
  "  force_disable_explicit_modules = lambda do |config|",
  "    # Xcode 16.4 uses _EXPERIMENTAL_SWIFT_EXPLICIT_MODULES; Xcode 26 uses SWIFT_ENABLE_EXPLICIT_MODULES.",
  "    config.build_settings['_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES'] = 'NO'",
  "    config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'",
  "  end",
  "  strip_modulemap_flags = lambda do |value|",
  "    return value unless value.to_s.include?('Cmlx.modulemap')",
  "    scrubbed = value.to_s",
  "      .gsub(/-fmodule-map-file(=|\\s+)[^\\s\"]*Cmlx\\.modulemap[^\\s\"]*/, '')",
  "      .gsub(/[^\\s\"]*Cmlx\\.modulemap[^\\s\"]*/, '')",
  "      .strip",
  "    scrubbed.empty? ? nil : scrubbed",
  "  end",
  "  scrub_build_settings = lambda do |settings|",
  "    settings.keys.each do |key|",
  "      value = settings[key]",
  "      next unless value.to_s.include?('Cmlx.modulemap')",
  "      if value.is_a?(Array)",
  "        sanitized = value.filter_map { |item| strip_modulemap_flags.call(item) }",
  "        settings[key] = sanitized",
  "      else",
  "        settings[key] = strip_modulemap_flags.call(value)",
  "      end",
  "    end",
  "    ['MODULEMAP_FILE', 'CLANG_MODULEMAP_FILE'].each do |key|",
  "      if settings[key].to_s.include?('Cmlx.modulemap')",
  "        settings.delete(key)",
  "      end",
  "    end",
  "  end",
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
  "      force_disable_explicit_modules.call(config)",
  "      ['input', 'output'].each do |filetype|",
  '        filelist = File.join(support_files_dir, "#{aggregate_target.name}-resources-#{config.name}-#{filetype}-files.xcfilelist")',
  "        File.write(filelist, '') unless File.exist?(filelist)",
  "      end",
  "    end",
  "    Dir.glob(File.join(support_files_dir, '*.xcconfig')).each do |xcconfig_path|",
  "      xcconfig = File.read(xcconfig_path)",
  "      updated = xcconfig",
  "        .lines",
  "        .map do |line|",
  "          next line unless line.include?('Cmlx.modulemap')",
  "          strip_modulemap_flags.call(line) || ''",
  "        end",
  "        .join",
  "      File.write(xcconfig_path, updated) if updated != xcconfig",
  "    end",
  "    if aggregate_target.respond_to?(:user_targets)",
  "      aggregate_target.user_targets.each do |user_target|",
  "        user_target.build_configurations.each do |config|",
  "          force_disable_explicit_modules.call(config)",
  "          scrub_build_settings.call(config.build_settings)",
  "        end",
  "      end",
  "    end",
  "  end",
  "  # Remove stale modulemap references that break archive builds.",
  "  installer.pods_project.targets.each do |target|",
  "    target.build_configurations.each do |config|",
  "      force_disable_explicit_modules.call(config)",
  "      config_ref = config.base_configuration_reference",
  "      next unless config_ref",
  "      xcconfig_path = config_ref.real_path",
  "      next unless xcconfig_path && File.exist?(xcconfig_path)",
  "      xcconfig = File.read(xcconfig_path)",
  "      updated = xcconfig",
  "        .lines",
  "        .map do |line|",
  "          next line unless line.include?('Cmlx.modulemap')",
  "          strip_modulemap_flags.call(line) || ''",
  "        end",
  "        .join",
  "      File.write(xcconfig_path, updated) if updated != xcconfig",
  "    end",
  "    target.build_configurations.each do |config|",
  "      force_disable_explicit_modules.call(config)",
  "      scrub_build_settings.call(config.build_settings)",
  "    end",
  "  end",
  "  installer.pods_project.build_configurations.each do |config|",
  "    force_disable_explicit_modules.call(config)",
  "  end",
].join("\n");

const SPM_MODULEMAP_CLEANUP = [
  "  # Ensure modulemap cleanup runs after post_integrate hooks too.",
  "  # We re-apply explicit module disabling here because other plugins can tweak",
  "  # build settings during integration.",
  "  force_disable_explicit_modules = lambda do |config|",
  "    config.build_settings['_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES'] = 'NO'",
  "    config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'",
  "  end",
  "  strip_modulemap_flags = lambda do |value|",
  "    return value unless value.to_s.include?('Cmlx.modulemap')",
  "    scrubbed = value.to_s",
  "      .gsub(/-fmodule-map-file(=|\\s+)[^\\s\"]*Cmlx\\.modulemap[^\\s\"]*/, '')",
  "      .gsub(/[^\\s\"]*Cmlx\\.modulemap[^\\s\"]*/, '')",
  "      .strip",
  "    scrubbed.empty? ? nil : scrubbed",
  "  end",
  "  scrub_build_settings = lambda do |settings|",
  "    settings.keys.each do |key|",
  "      value = settings[key]",
  "      next unless value.to_s.include?('Cmlx.modulemap')",
  "      if value.is_a?(Array)",
  "        sanitized = value.filter_map { |item| strip_modulemap_flags.call(item) }",
  "        settings[key] = sanitized",
  "      else",
  "        settings[key] = strip_modulemap_flags.call(value)",
  "      end",
  "    end",
  "    ['MODULEMAP_FILE', 'CLANG_MODULEMAP_FILE'].each do |key|",
  "      if settings[key].to_s.include?('Cmlx.modulemap')",
  "        settings.delete(key)",
  "      end",
  "    end",
  "  end",
  "  installer.aggregate_targets.each do |aggregate_target|",
  "    aggregate_target.user_targets.each do |user_target|",
  "      user_target.build_configurations.each do |config|",
  "        force_disable_explicit_modules.call(config)",
  "      end",
  "    end if aggregate_target.respond_to?(:user_targets)",
  "    Dir.glob(File.join(aggregate_target.support_files_dir, '*.xcconfig')).each do |xcconfig_path|",
  "      xcconfig = File.read(xcconfig_path)",
  "      updated = xcconfig",
  "        .lines",
  "        .map do |line|",
  "          next line unless line.include?('Cmlx.modulemap')",
  "          strip_modulemap_flags.call(line) || ''",
  "        end",
  "        .join",
  "      File.write(xcconfig_path, updated) if updated != xcconfig",
  "    end",
  "    if aggregate_target.respond_to?(:user_targets)",
  "      aggregate_target.user_targets.each do |user_target|",
  "        user_target.build_configurations.each do |config|",
  "          force_disable_explicit_modules.call(config)",
  "          scrub_build_settings.call(config.build_settings)",
  "        end",
  "      end",
  "    end",
  "  end",
  "  installer.pods_project.targets.each do |target|",
  "    target.build_configurations.each do |config|",
  "      force_disable_explicit_modules.call(config)",
  "      config_ref = config.base_configuration_reference",
  "      next unless config_ref",
  "      xcconfig_path = config_ref.real_path",
  "      next unless xcconfig_path && File.exist?(xcconfig_path)",
  "      xcconfig = File.read(xcconfig_path)",
  "      updated = xcconfig",
  "        .lines",
  "        .map do |line|",
  "          next line unless line.include?('Cmlx.modulemap')",
  "          strip_modulemap_flags.call(line) || ''",
  "        end",
  "        .join",
  "      File.write(xcconfig_path, updated) if updated != xcconfig",
  "    end",
  "    target.build_configurations.each do |config|",
  "      force_disable_explicit_modules.call(config)",
  "      scrub_build_settings.call(config.build_settings)",
  "    end",
  "  end",
  "  installer.pods_project.build_configurations.each do |config|",
  "    force_disable_explicit_modules.call(config)",
  "  end",
  "  # As a last resort, if a modulemap path sneaks back into any .pbxproj",
  "  # after CocoaPods saves, scrub the pbxproj text for BOTH the Pods project",
  "  # and the user project(s) that are part of the integration.",
  "  begin",
  "    projects = []",
  "    projects << installer.pods_project",
  "    if installer.respond_to?(:aggregate_targets)",
  "      installer.aggregate_targets.each do |at|",
  "        projects << at.user_project if at.respond_to?(:user_project) && at.user_project",
  "      end",
  "    end",
  "    projects.compact.uniq.each do |proj|",
  "      pbxproj = proj.path.to_s + '/project.pbxproj'",
  "      next unless File.exist?(pbxproj)",
  "      original = File.read(pbxproj)",
  "      scrubbed = original",
  "        .gsub(/-fmodule-map-file(=|\\s+)[^\\s\"]*Cmlx\\.modulemap[^\\s\"]*/, '')",
  "        .gsub(/[^\\s\"]*Cmlx\\.modulemap[^\\s\"]*/, '')",
  "        .gsub(/(_EXPERIMENTAL_SWIFT_EXPLICIT_MODULES|SWIFT_ENABLE_EXPLICIT_MODULES) = YES;/, '\\\\1 = NO;')",
  "      File.write(pbxproj, scrubbed) if scrubbed != original",
  "    end",
  "  rescue => e",
  "    Pod::UI.warn('[withMLXPods] post_integrate pbxproj scrub failed: ' + e.to_s)",
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

  const injectBeforeBlockEnd = (contents, blockName, rubyLines) => {
    const startNeedle = `${blockName} do |installer|`;
    const lines = contents.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => line.includes(startNeedle));
    if (startIndex === -1) return null;

    const stripComments = (line) => line.replace(/#.*$/, "");
    const countToken = (line, token) => {
      const matches = stripComments(line).match(
        new RegExp(`\\b${token}\\b`, "g"),
      );
      return matches ? matches.length : 0;
    };

    let depth = 1;
    for (let i = startIndex + 1; i < lines.length; i += 1) {
      const line = lines[i];
      depth += countToken(line, "do");
      depth -= countToken(line, "end");

      if (depth === 0) {
        lines.splice(i, 0, ...rubyLines.split("\n"));
        return lines.join("\n");
      }
    }

    return null;
  };

  let updatedPodfile = podfile;

  const postInstallInjected = injectBeforeBlockEnd(
    updatedPodfile,
    "post_install",
    SPM_FILELIST_GUARD,
  );
  if (postInstallInjected) {
    updatedPodfile = postInstallInjected;
  } else {
    // No post_install block: create one and run our guard at the end.
    updatedPodfile = `${updatedPodfile}\n\npost_install do |installer|\n${SPM_FILELIST_GUARD}\nend\n`;
  }

  const postIntegrateInjected = injectBeforeBlockEnd(
    updatedPodfile,
    "post_integrate",
    SPM_MODULEMAP_CLEANUP,
  );
  if (postIntegrateInjected) {
    return postIntegrateInjected;
  }

  return `${updatedPodfile}\n\npost_integrate do |installer|\n${SPM_MODULEMAP_CLEANUP}\nend\n`;
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
