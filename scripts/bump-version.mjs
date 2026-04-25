import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const versionFilePath = path.join(rootDir, 'src', 'utils', 'version.ts');
const packageJsonPath = path.join(rootDir, 'package.json');

function bumpVersion() {
  const args = process.argv.slice(2);
  const type = args[0] || 'patch'; // major, minor, patch
  const changeMessage = args[1] || 'Internal updates and fixes';

  // 1. Read and update version.ts
  let versionContent = fs.readFileSync(versionFilePath, 'utf8');
  const versionMatch = versionContent.match(/export const APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/);
  
  if (!versionMatch) {
    console.error('Could not find version in version.ts');
    process.exit(1);
  }

  let [full, major, minor, patch] = versionMatch;
  major = parseInt(major);
  minor = parseInt(minor);
  patch = parseInt(patch);

  if (type === 'major') major++;
  else if (type === 'minor') minor++;
  else patch++;

  if (type === 'major' || type === 'minor') patch = 0;
  if (type === 'major') minor = 0;

  const newVersion = `${major}.${minor}.${patch}`;
  const today = new Date().toISOString().split('T')[0];

  console.log(`Bumping version to v${newVersion}...`);

  // Update APP_VERSION
  versionContent = versionContent.replace(
    /export const APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/,
    `export const APP_VERSION = "${newVersion}"`
  );

  // Add new changelog entry
  const changelogStartMarker = 'export const CHANGELOG: ChangelogEntry[] = [';
  const newEntry = `  {
    version: "${newVersion}",
    date: "${today}",
    changes: [
      "${changeMessage}",
    ],
  },`;

  versionContent = versionContent.replace(
    changelogStartMarker,
    `${changelogStartMarker}\n${newEntry}`
  );

  fs.writeFileSync(versionFilePath, versionContent);

  // 2. Update package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  packageJson.version = newVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 6)); // Using 6 spaces to match current indentation

  console.log(`Successfully bumped to v${newVersion} and added changelog entry.`);
}

bumpVersion();
