/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  // Must not be "ATO" — that is the main app's Xcode target/product name.
  // A collision makes EAS sign the main app with the widget's AdHoc profile
  // (bundle ID mismatch, missing Push + Sign in with Apple).
  name: 'ATOWidget',
  displayName: 'ATO',
  bundleIdentifier: '.widget',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [
        'group.com.emgens.ato',
      ],
  },
  colors: {
    $accent: '#208AEF',
    $widgetBackground: '#F4F6F8',
  },
});
