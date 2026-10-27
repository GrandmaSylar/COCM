const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace root paths
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo workspace root
config.watchFolders = [workspaceRoot];

// 2. Resolve packages from this app first, then the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Prevent duplicate dependencies in the bundle (redirect to this app's node_modules)
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => path.join(projectRoot, 'node_modules', name),
  },
);

module.exports = config;
