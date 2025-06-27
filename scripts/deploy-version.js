#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

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
    console.log('🚀 Manual deployment to Google App Engine...\n');

    // Check if gcloud is installed
    try {
      execSync('gcloud --version', { stdio: 'pipe' });
    } catch (error) {
      console.error('❌ Google Cloud SDK not found. Please install it first.');
      console.log('   https://cloud.google.com/sdk/docs/install');
      process.exit(1);
    }

    // Get current project
    let currentProject;
    try {
      currentProject = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.log('⚠️  No default project set in gcloud config');
    }

    if (currentProject) {
      console.log(`📂 Current GCP project: ${currentProject}`);
    }

    // Ask for version name
    const versionName = await askQuestion('🔢 Enter version name for this deployment: ');
    
    if (!versionName.trim()) {
      console.log('❌ Version name cannot be empty');
      process.exit(1);
    }

    // Clean version name for App Engine (alphanumeric and hyphens only)
    const cleanVersionName = versionName.trim().replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    
    if (cleanVersionName !== versionName.trim()) {
      console.log(`📝 Version name cleaned: ${versionName.trim()} → ${cleanVersionName}`);
    }

    // Ask if this should be the default version
    const makeDefault = await askQuestion('🎯 Make this the default version? (Y/n): ');
    const shouldPromote = makeDefault.toLowerCase() !== 'n' && makeDefault.toLowerCase() !== 'no';

    // Ask if previous version should be stopped
    const stopPrevious = await askQuestion('🛑 Stop previous version? (Y/n): ');
    const shouldStopPrevious = stopPrevious.toLowerCase() !== 'n' && stopPrevious.toLowerCase() !== 'no';

    console.log('\n📋 Deployment Summary:');
    console.log(`   Version: ${cleanVersionName}`);
    console.log(`   Promote to default: ${shouldPromote ? 'Yes' : 'No'}`);
    console.log(`   Stop previous version: ${shouldStopPrevious ? 'Yes' : 'No'}`);
    
    const confirm = await askQuestion('\n✅ Continue with deployment? (y/N): ');
    
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Deployment cancelled');
      process.exit(0);
    }

    // Build and test first
    console.log('\n🔨 Building project...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('🧪 Running tests...');
    execSync('npm test', { stdio: 'inherit' });

    // Prepare deployment command
    let deployCmd = `gcloud app deploy app.yaml --version=${cleanVersionName} --quiet`;
    
    if (shouldPromote) {
      deployCmd += ' --promote';
    } else {
      deployCmd += ' --no-promote';
    }
    
    if (shouldStopPrevious) {
      deployCmd += ' --stop-previous-version';
    }

    console.log('\n🚀 Deploying to Google App Engine...');
    console.log(`   Command: ${deployCmd}`);
    
    execSync(deployCmd, { stdio: 'inherit' });

    console.log('\n🎉 Deployment successful!');
    
    if (currentProject) {
      console.log(`📊 View your app: https://${currentProject}.appspot.com`);
      console.log(`⚙️  Manage versions: https://console.cloud.google.com/appengine/versions?project=${currentProject}`);
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();