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
    console.log('🏷️  Creating a new version for deployment...\n');

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
      console.log('❌ Version must follow semantic versioning format (e.g., 1.0.0, 1.0.0-beta.1)');
      process.exit(1);
    }

    const cleanVersion = newVersion.trim();
    
    // Ask for commit message
    const commitMessage = await askQuestion(`📝 Enter commit message (optional): `) || `Release version ${cleanVersion}`;
    
    // Confirm the action
    const confirm = await askQuestion(`\n✅ Create version ${cleanVersion} and push tag? (y/N): `);
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled');
      process.exit(0);
    }

    console.log('\n🔄 Creating version...');

    // Update package.json version
    packageJson.version = cleanVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✅ Updated package.json version');

    // Build and test
    console.log('🔨 Building project...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('🧪 Running tests...');
    execSync('npm test', { stdio: 'inherit' });

    // Git operations
    console.log('📦 Committing changes...');
    execSync('git add package.json', { stdio: 'inherit' });
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    
    console.log('🏷️  Creating git tag...');
    const tagName = `v${cleanVersion}`;
    execSync(`git tag ${tagName}`, { stdio: 'inherit' });
    
    console.log('⬆️  Pushing to repository...');
    execSync('git push origin main', { stdio: 'inherit' });
    execSync(`git push origin ${tagName}`, { stdio: 'inherit' });

    console.log(`\n🎉 Version ${cleanVersion} created successfully!`);
    console.log(`🚀 Tag ${tagName} pushed - GitHub Actions will deploy automatically`);
    console.log(`📊 Monitor deployment at: https://github.com/${process.env.GITHUB_REPOSITORY || 'your-repo'}/actions`);

  } catch (error) {
    console.error('❌ Error creating version:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();