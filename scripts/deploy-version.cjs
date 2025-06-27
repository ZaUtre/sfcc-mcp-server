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

    // Ask for version
    const version = await askQuestion('🔢 Enter version to deploy: ');
    if (!version.trim()) {
      console.log('❌ Version cannot be empty');
      process.exit(1);
    }

    // Deploy
    try {
      execSync(`gcloud app deploy --version=${version.trim()}`, { stdio: 'inherit' });
      console.log('✅ Deployment complete');
    } catch (error) {
      console.error('❌ Deployment failed:', error.message);
      process.exit(1);
    }

    rl.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
