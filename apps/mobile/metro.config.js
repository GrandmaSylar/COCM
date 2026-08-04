const { getDefaultConfig } = require('expo/metro-config');
const { withTamagui } = require('@tamagui/metro-plugin');
const path = require('path');

// Find the project and workspace root paths
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo workspace root
config.watchFolders = [workspaceRoot];

// 2. Force Metro to resolve shared packages to the workspace local node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Prevent duplicate dependencies in bundle resolution (redirect to mobile's node_modules)
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      return path.join(projectRoot, 'node_modules', name);
    },
  }
);

module.exports = withTamagui(config, {
  components: ['tamagui'],
  config: './tamagui.config.ts',
  outputCSS: './tamagui.css',
});
