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

function runCommand(command, description) {
  try {
    console.log(`🔄 ${description}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

async function main() {
  try {
    console.log('🚀 Setting up Google Cloud for automated deployment...\n');

    // Check if gcloud is installed
    try {
      execSync('gcloud --version', { stdio: 'pipe' });
      console.log('✅ Google Cloud SDK is installed');
    } catch (error) {
      console.error('❌ Google Cloud SDK not found. Please install it first:');
      console.log('   https://cloud.google.com/sdk/docs/install');
      process.exit(1);
    }

    // ...existing code...

    rl.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
