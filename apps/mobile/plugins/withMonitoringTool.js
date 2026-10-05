const { withAndroidManifest } = require('@expo/config-plugins');

// ponytail: Play requires apps that track another person's location (here:
// employers tracking workers' clock-in geolocation) to self-declare via this
// flag on every version code, or Play Protect flags the app as stalkerware.
// Upgrade path: none — this is permanent policy compliance, not a shortcut.
module.exports = function withMonitoringTool(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app['meta-data'] = app['meta-data'] || [];
    app['meta-data'].push({
      $: {
        'android:name': 'isMonitoringTool',
        'android:value': 'enterprise_management',
      },
    });
    return config;
  });
};
