const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root for shared packages
config.watchFolders = [monorepoRoot];

// Ensure mobile workspace node_modules takes priority over root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Prevent duplicate React/React Native from root node_modules
config.resolver.disableHierarchicalLookup = true;

// Inject SharedArrayBuffer + Atomics polyfill before all modules (fixes Hermes on Expo Go)
const defaultGetPolyfills = config.serializer?.getPolyfills || require('react-native/rn-get-polyfills');
config.serializer = {
  ...config.serializer,
  getPolyfills: (ctx) => [
    path.resolve(projectRoot, 'globals.js'),
    ...defaultGetPolyfills(ctx),
  ],
};

module.exports = config;
