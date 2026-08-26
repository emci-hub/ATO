const { withXcodeProject } = require('expo/config-plugins');

/**
 * Expo SDK 54 writes ASSETCATALOG_COMPILER_APPICON_NAME ("expo", from
 * ios.icon = "./assets/expo.icon") onto the *project* build settings, not
 * only the main app target. Every extension then inherits it, and actool
 * fails because the widget catalog has no icon set named "expo".
 *
 * Widgets do not need an app icon. Strip the project-level setting so only
 * targets that actually define PRODUCT_BUNDLE_IDENTIFIER + their own catalog
 * keep an icon name. See:
 * https://github.com/EvanBacon/expo-apple-targets/issues/159
 * https://github.com/expo/expo/pull/41536
 */
function withWidgetAppIconScope(config) {
  return withXcodeProject(config, (exported) => {
    const buildConfigs = exported.modResults.pbxXCBuildConfigurationSection();
    for (const buildConfig of Object.values(buildConfigs)) {
      const settings = buildConfig.buildSettings;
      if (!settings) continue;

      const bundleId = settings.PRODUCT_BUNDLE_IDENTIFIER;
      if (bundleId == null) {
        delete settings.ASSETCATALOG_COMPILER_APPICON_NAME;
        continue;
      }

      const id = String(bundleId).replace(/^"|"$/g, '');
      if (id.endsWith('.widget')) {
        delete settings.ASSETCATALOG_COMPILER_APPICON_NAME;
      }
    }
    return exported;
  });
}

module.exports = withWidgetAppIconScope;
