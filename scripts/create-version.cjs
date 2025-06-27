#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  try {
    console.log('🗷  Creating a new version for deployment...\n');

    // Get current version from package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version || '1.0.0';
    
    console.log(`📦 Current version: ${currentVersion}`);
    
    // Ask for new version
    const newVersion = await askQuestion(`🔢 Enter new version (current: ${currentVersion}): `);
    
    if (!newVersion.trim()) {
      console.log('❌ Version cannot be empty');
      process.exit(1);
    }

    // Validate version format (basic semver check)
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
    if (!versionRegex.test(newVersion.trim())) {
      console.log('❌ Invalid version format. Use x.y.z or x.y.z-suffix');
      process.exit(1);
    }

    // Update package.json
    packageJson.version = newVersion.trim();
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✅ Updated version to ${newVersion.trim()} in package.json`);

    rl.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
