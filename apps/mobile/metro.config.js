const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Monorepo: permite a Metro ver packages/api-client
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// android/ e ios/ son output nativo (Gradle/Xcode), no código de la app —
// vigilarlos hace que Metro crashee en Windows cuando Gradle borra carpetas
// de build a mitad de un watch (ENOENT en mergeDebugResources/*).
config.resolver.blockList = [
  /apps\/mobile\/android\/.*/,
  /apps\/mobile\/ios\/.*/,
];

// Alias @api-client → packages/api-client/src/index.ts
config.resolver.extraNodeModules = {
  '@api-client': path.resolve(monorepoRoot, 'packages/api-client/src/index.ts'),
};

module.exports = withNativeWind(config, { input: './global.css' });
