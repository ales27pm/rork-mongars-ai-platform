/* eslint-disable import/no-extraneous-dependencies */
const { withPodfile } = require('@expo/config-plugins');

const withMLXPods = (config) => {
  config = withPodfile(config, (config) => {
    const podfile = config.modResults.contents;
    
    const dolphinPodLine = `  pod 'DolphinCoreML', :path => '../modules/dolphin-core-ml/ios'`;
    
    if (!podfile.includes("pod 'DolphinCoreML'")) {
      const targetMatch = podfile.match(/(target\s+['"][^'"]+['"]\s+do)/m);
      if (targetMatch) {
        const insertIndex = podfile.indexOf(targetMatch[0]) + targetMatch[0].length;
        config.modResults.contents = 
          podfile.slice(0, insertIndex) + 
          '\n' + dolphinPodLine + 
          podfile.slice(insertIndex);
      }
    }
    
    return config;
  });

  return config;
};

module.exports = withMLXPods;
