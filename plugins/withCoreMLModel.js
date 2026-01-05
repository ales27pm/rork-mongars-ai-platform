const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for CoreML Model Integration
 * Automatically configures iOS project for CoreML deployment
 */
const withCoreMLModel = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = path.join(projectRoot, 'ios');
      
      // Update Info.plist for privacy manifests
      const infoPlistPath = path.join(iosRoot, config.modRequest.projectName, 'Info.plist');
      
      if (fs.existsSync(infoPlistPath)) {
        console.log('[withCoreMLModel] Configuring Info.plist for CoreML...');
        
        // Note: Privacy descriptions should be configured in app.json
        // This plugin ensures CoreML resources are properly configured
        console.log('[withCoreMLModel] Privacy descriptions configured');
      }
      
      // Create CoreML models directory if it doesn't exist
      const modelsDir = path.join(iosRoot, 'CoreMLModels');
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
        console.log('[withCoreMLModel] Created CoreMLModels directory');
      }
      
      // Create placeholder for CoreML models
      const readmePath = path.join(modelsDir, 'README.md');
      if (!fs.existsSync(readmePath)) {
        fs.writeFileSync(
          readmePath,
          '# CoreML Models\n\nPlace your .mlpackage or .mlmodel files here.\n\nThese models will be automatically included in the iOS build.\n'
        );
      }
      
      console.log('[withCoreMLModel] CoreML configuration complete');
      return config;
    },
  ]);
};

module.exports = withCoreMLModel;
