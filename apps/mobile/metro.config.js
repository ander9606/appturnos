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

// Alias @api-client → packages/api-client/src/index.ts
config.resolver.extraNodeModules = {
  '@api-client': path.resolve(monorepoRoot, 'packages/api-client/src/index.ts'),
};

module.exports = withNativeWind(config, { input: './global.css' });
