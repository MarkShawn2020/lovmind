#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Get bump type from environment variable or default to patch
// Usage: BUMP=minor git commit -m "..." or BUMP=major git commit -m "..."
const bumpType = process.env.BUMP || 'patch';
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

console.log('✨ Version bump complete!');
