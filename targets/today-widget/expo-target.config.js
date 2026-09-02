/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'TodayPlanWidget',
  // Must match HomeWidgetModule.appGroupIdentifier and the app's entitlement.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.ercode.microphonecheck'],
  },
  colors: {
    $accent: '#00FFFF',
    $widgetBackground: '#0B0B10',
  },
};
