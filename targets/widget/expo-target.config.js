/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'ATO',
  displayName: 'ATO',
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
