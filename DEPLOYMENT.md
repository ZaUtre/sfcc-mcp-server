# Automated Deployment Guide

This guide explains how to set up and use the automated deployment system for the SFCC MCP Server on Google App Engine.

## Quick Start

1. **Set up Google Cloud:**
   ```bash
   npm run setup:gcp
   ```

2. **Create a new version and deploy:**
   ```bash
   npm run version:create
   ```

3. **Manual deployment:**
   ```bash
   npm run version:deploy
   ```

## Detailed Setup

### 1. Google Cloud Configuration

First, ensure you have the Google Cloud SDK installed and authenticated:

```bash
# Install gcloud (if not already installed)
# Follow instructions at: https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable appengine.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Create App Engine application (one-time setup)
gcloud app create --region=us-central
```

### 2. GitHub Actions Setup

The repository includes a GitHub Actions workflow that automatically deploys when you push version tags.

#### Required GitHub Secrets

In your GitHub repository settings, add these secrets:

- **`GCP_PROJECT_ID`**: Your Google Cloud Project ID
- **`GCP_SA_KEY`**: Service account key JSON (base64 encoded)

#### Creating the Service Account

```bash
# Create service account
gcloud iam service-accounts create github-deployer \
  --description="Service account for GitHub Actions deployment" \
  --display-name="GitHub Deployer"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/appengine.deployer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/appengine.serviceAdmin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create key file
gcloud iam service-accounts keys create key.json \
  --iam-account=github-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com

# Encode for GitHub secret
base64 key.json
```

### 3. Environment Variables

Configure your App Engine environment variables in `app.yaml`:

```yaml
env_variables:
  NODE_ENV: production
  MCP_MODE: remote
  PORT: 8080
  SFCC_API_BASE: "https://your-instance.commercecloud.salesforce.com"
  SFCC_ADMIN_CLIENT_ID: "your-client-id"
  SFCC_ADMIN_CLIENT_SECRET: "your-client-secret"
  SFCC_SITE_ID: "your-site-id"
```

## Deployment Methods

### Automatic Deployment (Recommended)

1. **Create a new version:**
   ```bash
   npm run version:create
   ```
   This script will:
   - Prompt for a new version number
   - Update `package.json`
   - Run tests
   - Create a git tag
   - Push to repository
   - Trigger automatic deployment via GitHub Actions

2. **Monitor deployment:**
   - Go to your repository's Actions tab
   - Watch the "Deploy to Google App Engine" workflow

### Manual Deployment

1. **Using the deployment script:**
   ```bash
   npm run version:deploy
   ```

2. **Direct gcloud command:**
   ```bash
   npm run build
   npm test
   gcloud app deploy --version=v1-0-0 --promote
   ```

### Emergency Manual Trigger

You can manually trigger deployment from GitHub:

1. Go to Actions tab in your repository
2. Select "Deploy to Google App Engine" workflow
3. Click "Run workflow"
4. Enter the version tag to deploy

## Version Management

### Version Naming Convention

- Use semantic versioning: `1.0.0`, `1.0.1`, `2.0.0`
- Tags are prefixed with `v`: `v1.0.0`
- App Engine versions are cleaned: `v1.0.0` becomes `v1-0-0`

### Version Commands

```bash
# Interactive version creation
npm run version:create

# Manual deployment with version input
npm run version:deploy

# Direct deployment (uses current timestamp)
npm run deploy

# Deploy specific version
npm run deploy:version -- v1-0-0
```

## Monitoring and Management

### Health Checks

The application includes health check endpoints:
- `/health` - Basic health check

### Viewing Deployed Versions

```bash
# List all versions
gcloud app versions list

# View specific version
gcloud app versions describe VERSION_ID

# Set traffic allocation
gcloud app services set-traffic default --splits=v1-0-0=100
```

### Logs and Monitoring

```bash
# View logs
gcloud app logs tail

# View logs for specific version
gcloud app logs tail --version=v1-0-0

# Open App Engine console
gcloud app browse
```

## Troubleshooting

### Common Issues

1. **Deployment fails with permission errors:**
   - Verify service account has correct roles
   - Check GitHub secrets are properly configured

2. **Build fails during deployment:**
   - Ensure all tests pass locally
   - Check dependencies are properly installed

3. **App Engine quota exceeded:**
   - Check your Google Cloud billing and quotas
   - Consider cleaning up old versions

### Debug Commands

```bash
# Test build locally
npm run build
npm test

# Test deployment configuration
gcloud app deploy --no-promote --version=test

# Check service account permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID
```

## Best Practices

1. **Always test locally before deploying**
2. **Use version tags for production deployments**
3. **Monitor application after deployment**
4. **Keep old versions available for quick rollback**
5. **Use environment-specific configurations**
6. **Regularly clean up unused versions to manage costs**

## Security Considerations

- Store sensitive environment variables in Google Cloud Secret Manager
- Use least-privilege service accounts
- Regularly rotate service account keys
- Monitor deployment logs for any security issues