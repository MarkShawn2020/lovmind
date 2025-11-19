#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Auto-detect bump type from git commit message
function detectBumpType() {
  // Check environment variable first
  if (process.env.BUMP) {
    return process.env.BUMP.toLowerCase();
  }

  try {
    // Get commit message file path from command line argument (passed by prepare-commit-msg hook)
    // prepare-commit-msg passes: $1 = commit message file path
    const commitMsgFile = process.argv[2] || path.join(__dirname, '..', '.git', 'COMMIT_EDITMSG');

    if (fs.existsSync(commitMsgFile)) {
      const commitMsg = fs.readFileSync(commitMsgFile, 'utf8').trim();

      // Skip if commit message is empty (e.g., during git commit without -m)
      if (!commitMsg) {
        return 'patch';
      }

      const firstLine = commitMsg.split('\n')[0];

      // Check for breaking changes (MAJOR)
      // Look for "BREAKING CHANGE:" in footer or "!:" in header
      const hasBreakingFooter = /^BREAKING CHANGE:/m.test(commitMsg);
      const hasBreakingHeader = /^[a-z]+(\(.+?\))?!:/.test(firstLine);

      if (hasBreakingFooter || hasBreakingHeader) {
        return 'major';
      }

      // Check for features (MINOR)
      // Only match feat: at the beginning of the first line
      if (/^feat(\(.+?\))?:/.test(firstLine)) {
        return 'minor';
      }

      // Default to PATCH for fix, docs, style, refactor, perf, test, chore, etc.
      return 'patch';
    }
  } catch (error) {
    console.warn('Warning: Could not read commit message, defaulting to patch');
  }

  return 'patch';
}

const bumpType = detectBumpType();
const [major, minor, patch] = packageJson.version.split('.').map(Number);

let version;
switch (bumpType.toLowerCase()) {
  case 'major':
    version = `${major + 1}.0.0`;
    console.log('💥 Major version bump');
    break;
  case 'minor':
    version = `${major}.${minor + 1}.0`;
    console.log('📦 Minor version bump');
    break;
  case 'patch':
  default:
    version = `${major}.${minor}.${patch + 1}`;
    console.log('🔧 Patch version bump');
    break;
}

console.log(`Updating version: ${packageJson.version} → ${version}`);

// Update package.json
packageJson.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✓ Updated package.json');

// Update tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = version;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log('✓ Updated tauri.conf.json');

// Update Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(/^version = "[^"]*"$/m, `version = "${version}"`);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log('✓ Updated Cargo.toml');

// Update Cargo.lock via cargo update
try {
  execSync('cargo update -p lovmind', { cwd: path.join(__dirname, '..', 'src-tauri'), stdio: 'inherit' });
  console.log('✓ Updated Cargo.lock');
} catch (error) {
  console.warn('⚠ Warning: Could not update Cargo.lock automatically. Run `cd src-tauri && cargo update -p lovmind` manually.');
}

console.log('✨ Version bump complete!');
