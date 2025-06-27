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

    // Check authentication
    try {
      const account = execSync('gcloud config get-value account', { encoding: 'utf8' }).trim();
      if (account && account !== '(unset)') {
        console.log(`✅ Authenticated as: ${account}`);
      } else {
        throw new Error('Not authenticated');
      }
    } catch (error) {
      console.log('🔐 You need to authenticate with Google Cloud first');
      const shouldAuth = await askQuestion('   Run authentication now? (Y/n): ');
      if (shouldAuth.toLowerCase() !== 'n' && shouldAuth.toLowerCase() !== 'no') {
        runCommand('gcloud auth login', 'Authenticating with Google Cloud');
      } else {
        console.log('   Please run: gcloud auth login');
        process.exit(1);
      }
    }

    // Get or set project ID
    let projectId;
    try {
      projectId = execSync('gcloud config get-value project', { encoding: 'utf8' }).trim();
      if (projectId && projectId !== '(unset)') {
        console.log(`📂 Current project: ${projectId}`);
        const useProject = await askQuestion(`   Use this project? (Y/n): `);
        if (useProject.toLowerCase() === 'n' || useProject.toLowerCase() === 'no') {
          projectId = null;
        }
      }
    } catch (error) {
      // No project set
    }

    if (!projectId) {
      projectId = await askQuestion('📂 Enter your Google Cloud Project ID: ');
      if (!projectId.trim()) {
        console.log('❌ Project ID cannot be empty');
        process.exit(1);
      }
      projectId = projectId.trim();
      
      if (!runCommand(`gcloud config set project ${projectId}`, 'Setting project')) {
        process.exit(1);
      }
    }

    // Enable required APIs
    console.log('\n📡 Enabling required APIs...');
    const apis = [
      'appengine.googleapis.com',
      'cloudbuild.googleapis.com'
    ];

    for (const api of apis) {
      runCommand(`gcloud services enable ${api}`, `Enabling ${api}`);
    }

    // Check if App Engine app exists
    console.log('\n🏗️  Checking App Engine application...');
    try {
      execSync(`gcloud app describe --project=${projectId}`, { stdio: 'pipe' });
      console.log('✅ App Engine application already exists');
    } catch (error) {
      console.log('📍 App Engine application not found');
      const createApp = await askQuestion('   Create App Engine application? (Y/n): ');
      if (createApp.toLowerCase() !== 'n' && createApp.toLowerCase() !== 'no') {
        const region = await askQuestion('   Enter region (default: us-central): ') || 'us-central';
        runCommand(`gcloud app create --region=${region} --project=${projectId}`, 'Creating App Engine application');
      }
    }

    // Create service account for GitHub Actions
    console.log('\n🔑 Setting up service account for GitHub Actions...');
    const serviceAccountName = 'github-deployer';
    const serviceAccountEmail = `${serviceAccountName}@${projectId}.iam.gserviceaccount.com`;

    // Check if service account exists
    try {
      execSync(`gcloud iam service-accounts describe ${serviceAccountEmail} --project=${projectId}`, { stdio: 'pipe' });
      console.log('✅ Service account already exists');
    } catch (error) {
      console.log('👤 Creating service account...');
      runCommand(
        `gcloud iam service-accounts create ${serviceAccountName} --description="Service account for GitHub Actions deployment" --display-name="GitHub Deployer" --project=${projectId}`,
        'Creating service account'
      );
    }

    // Grant necessary permissions
    console.log('🔐 Granting permissions...');
    const roles = [
      'roles/appengine.deployer',
      'roles/appengine.serviceAdmin',
      'roles/storage.admin'
    ];

    for (const role of roles) {
      runCommand(
        `gcloud projects add-iam-policy-binding ${projectId} --member="serviceAccount:${serviceAccountEmail}" --role="${role}"`,
        `Granting ${role}`
      );
    }

    // Create service account key
    console.log('\n🗝️  Creating service account key...');
    const keyFile = 'github-sa-key.json';
    
    try {
      runCommand(
        `gcloud iam service-accounts keys create ${keyFile} --iam-account=${serviceAccountEmail} --project=${projectId}`,
        'Creating service account key'
      );

      // Encode key for GitHub secret
      const fs = require('fs');
      const keyContent = fs.readFileSync(keyFile, 'utf8');
      const encodedKey = Buffer.from(keyContent).toString('base64');

      console.log('\n📋 GitHub Secrets Configuration:');
      console.log('   Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):');
      console.log(`   
   GCP_PROJECT_ID:
   ${projectId}
   
   GCP_SA_KEY:
   ${encodedKey}
      `);

      // Clean up key file
      fs.unlinkSync(keyFile);
      console.log('✅ Service account key file cleaned up');

    } catch (error) {
      console.error('❌ Failed to create service account key');
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📖 Next Steps:');
    console.log('   1. Add the GitHub secrets shown above to your repository');
    console.log('   2. Configure environment variables in app.yaml');
    console.log('   3. Create your first version: npm run version:create');
    console.log('   4. See DEPLOYMENT.md for detailed instructions');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();