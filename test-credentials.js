// test-credentials.js - Simple script to test SFCC API client credentials
import { config } from "dotenv";
import fetch from "node-fetch";
import readline from 'readline';

// Load environment variables
config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to prompt for input
const prompt = (question) => new Promise((resolve) => {
  rl.question(question, (answer) => resolve(answer));
});

// Function to test admin API token with given credentials
async function testCredentials(clientId, clientSecret, realmId, instanceId) {
  console.log("\nTesting Authentication with provided credentials...");
  
  try {
    // Token URL as per documentation
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    console.log("Token URL:", tokenUrl);
    
    // Try a simpler scope format that matches the allowed scopes in the API client config
    const scopeValue = `sfcc.catalogs`;
    console.log("Requesting scope:", scopeValue);
    
    // Show equivalent curl command for debugging
    console.log("\nEquivalent curl command:");
    console.log(`curl "${tokenUrl}" \\`);
    console.log(`  --request 'POST' \\`);
    console.log(`  --header 'Content-Type: application/x-www-form-urlencoded' \\`);
    console.log(`  --data "grant_type=client_credentials" \\`);
    console.log(`  --data "client_id=${clientId}" \\`);
    console.log(`  --data "client_secret=****" \\`);
    console.log(`  --data-urlencode "scope=${scopeValue}"`);
    
    // Create form data for POST request
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', scopeValue);
    
    // Configure auth based on the endpoint auth method
    // For client_secret_post method, include credentials in the form body
    console.log("Using client_secret_post method (credentials in form body)");
    
    // Add client credentials to the form data
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });
    
    console.log("\nResponse status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      return false;
    }
    
    const tokenData = await response.json();
    console.log("Successfully obtained token!");
    console.log("Token type:", tokenData.token_type);
    console.log("Expires in:", tokenData.expires_in, "seconds");
    
    if (tokenData.scope) {
      console.log("Scopes:", tokenData.scope);
    }
    
    return true;
  } catch (error) {
    console.error("Error testing authentication:", error);
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log("SFCC API Credentials Tester");
    console.log("==========================");
    
    // Get command line arguments
    const args = process.argv.slice(2);
    
    // Check for command line arguments first
    let useCommandLine = false;
    let clientId, clientSecret, realmId, instanceId;
    
    if (args.length >= 4) {
      useCommandLine = true;
      [clientId, clientSecret, realmId, instanceId] = args;
      console.log("Using command line arguments for credentials.");
    } else {
      // Get credentials from .env
      clientId = process.env.SFCC_ADMIN_CLIENT_ID;
      clientSecret = process.env.SFCC_ADMIN_CLIENT_SECRET;
      let organizationId = process.env.SFCC_ORGANIZATION_ID || "";
      let shortCode = process.env.SFCC_SHORT_CODE || "";
      
      // Extract realm ID from organization ID
      realmId = organizationId.replace('f_ecom_', '');
      instanceId = shortCode;
      
      console.log("Current configuration:");
      console.log(`- Client ID: ${clientId ? "****" + clientId.slice(-4) : "Not set"}`);
      console.log(`- Client Secret: ${clientSecret ? "Present" : "Not set"}`);
      console.log(`- Organization ID: ${organizationId}`);
      console.log(`- Short Code: ${shortCode}`);
      console.log(`- Extracted Realm ID: ${realmId}`);
      console.log(`- Instance ID: ${instanceId}`);
    }
    
    if (!useCommandLine) {
      // Ask if user wants to use these credentials or enter new ones
      const useExisting = await prompt("\nUse these credentials? (y/n): ");
      
      if (useExisting.toLowerCase() !== 'y') {
        clientId = await prompt("Enter Client ID: ");
        clientSecret = await prompt("Enter Client Secret: ");
        realmId = await prompt("Enter Realm ID (e.g., 'bcdt_006'): ");
        instanceId = await prompt("Enter Instance ID (e.g., 's9qc47ab'): ");
      }
    }
    
    // Test the credentials
    const success = await testCredentials(clientId, clientSecret, realmId, instanceId);
    
    if (success) {
      console.log("\n✅ Authentication successful!");
      console.log("These credentials work correctly with the SFCC Admin API.");
    } else {
      console.log("\n❌ Authentication failed!");
      console.log("Please check your credentials and try again.");
    }
    
  } catch (error) {
    console.error("Error in main process:", error);
  } finally {
    rl.close();
  }
}

// Run the main function
main();