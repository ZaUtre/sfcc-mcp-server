// test-scapi.js
import { config } from "dotenv";
import fetch from 'node-fetch';

// Load environment variables
config();

// SFCC API credentials
const SFCC_API_BASE = process.env.SFCC_API_BASE;
const SFCC_CLIENT_ID = process.env.SFCC_CLIENT_ID;
const SFCC_CLIENT_SECRET = process.env.SFCC_CLIENT_SECRET;
const SFCC_ORGANIZATION_ID = process.env.SFCC_ORGANIZATION_ID;
const SFCC_SHORT_CODE = process.env.SFCC_SHORT_CODE;
const SFCC_SITE_ID = process.env.SFCC_SITE_ID || "RefArch";

// Get an authorization token
async function getAuthToken() {
  const authUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/customer/shopper-customers/v1/organizations/${SFCC_ORGANIZATION_ID}/customers/actions/login?siteId=${SFCC_SITE_ID}`;
  
  try {
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${SFCC_CLIENT_ID}:${SFCC_CLIENT_SECRET}`).toString('base64')}`
      },
      body: JSON.stringify({
        type: 'guest'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Auth request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
}

// Get a product by ID
async function getProduct(id) {
  try {
    const token = await getAuthToken();
    
    // Construct the URL for the ShopperProducts API
    const productUrl = `https://${SFCC_SHORT_CODE}.api.commercecloud.salesforce.com/product/shopper-products/v1/organizations/${SFCC_ORGANIZATION_ID}/products/${id}?siteId=${SFCC_SITE_ID}`;
    
    console.log(`Making request to: ${productUrl}`);
    
    const response = await fetch(productUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-dw-client-id': SFCC_CLIENT_ID
      }
    });
    
    if (!response.ok) {
      throw new Error(`Product request failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
}

// Main function to test the API
async function main() {
  try {
    console.log("Testing SFCC API Connection...");
    console.log("Using configuration:");
    console.log(`- API Base: ${SFCC_API_BASE}`);
    console.log(`- Organization ID: ${SFCC_ORGANIZATION_ID}`);
    console.log(`- Site ID: ${SFCC_SITE_ID}`);
    
    // Get a product
    const productId = process.argv[2] || "5"; // Default to product ID "5" if not provided
    console.log(`\nFetching product with ID: ${productId}`);
    
    const product = await getProduct(productId);
    console.log("\nProduct Details:");
    console.log(JSON.stringify(product, null, 2));
    
  } catch (error) {
    console.error("\nTest failed with error:", error);
  }
}

// Run the main function
main();