// test-admin-auth-raw.js - Test with directly specified values for comparison
import { config } from "dotenv";
import fetch from "node-fetch";

// Function to test admin API token with exact credentials from example
async function testAdminAuth() {
  console.log("Testing Admin API Authentication with sample credentials...");
  
  try {
    // Token URL 
    const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
    console.log("Token URL:", tokenUrl);
    
    // Sample credentials from the curl example
    const clientId = "1d763261-6522-4913-9d52-5d947d3b94c4";
    const clientSecret = "GS8KmdDEUKfWnEnv";
    // These are sample/example values, not real credentials
    
    // Sample scope from the curl example
    const scopeValue = "SALESFORCE_COMMERCE_API:zzte_053 sfcc.catalogs";
    console.log("Using scope:", scopeValue);
    
    // Create form data for POST request
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', scopeValue);
    
    // Log exactly what curl would be doing
    const curlCmd = `curl "${tokenUrl}" --request 'POST' --user "${clientId}:${clientSecret}" --header 'Content-Type: application/x-www-form-urlencoded' --data "grant_type=client_credentials" --data-urlencode "scope=${scopeValue}"`;
    console.log("Equivalent curl command:", curlCmd);
    
    // Basic auth header with client credentials
    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    console.log("Authorization header:", `Basic ${authHeader.substring(6, 15)}...`);
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader
      },
      body: formData.toString()
    });
    
    console.log("Response status:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      
      console.log("\nLet's verify if our basic auth encoding is correct:");
      // Verify the base64 encoding
      const encodedCredentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      console.log("Base64 encoded credentials:", encodedCredentials);
      // Decode to verify
      const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
      console.log("Decoded back:", decodedCredentials);
      console.log("Does it match the original?", decodedCredentials === `${clientId}:${clientSecret}`);
      
      return;
    }
    
    const tokenData = await response.json();
    console.log("Successfully obtained token!");
    console.log("Token type:", tokenData.token_type);
    console.log("Expires in:", tokenData.expires_in, "seconds");
    
    if (tokenData.scope) {
      console.log("Scopes:", tokenData.scope);
    }
  } catch (error) {
    console.error("Error testing admin auth:", error);
  }
}

// Run the test
testAdminAuth();