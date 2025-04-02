/**
 * SFCC OCAPI Data API Sample - Admin Authentication
 * 
 * This script demonstrates how to authenticate and make requests to the
 * Salesforce Commerce Cloud OCAPI Data API using admin credentials.
 * 
 * IMPORTANT: To use this sample:
 * 1. Ensure you have valid API client credentials in your .env file
 * 2. Verify the API client has appropriate permissions for the OCAPI Data API
 * 3. Check that API endpoints and instance URLs are correct
 */

import dotenv from 'dotenv';
import axios from 'axios';
import querystring from 'querystring';

// Load environment variables
dotenv.config();

// SFCC Admin credentials from .env
const clientId = process.env.SFCC_ADMIN_CLIENT_ID;
const clientSecret = process.env.SFCC_ADMIN_CLIENT_SECRET;
const apiBase = process.env.SFCC_API_BASE;
const organizationId = process.env.SFCC_ORGANIZATION_ID;
const shortCode = process.env.SFCC_SHORT_CODE;

// Function to get auth token using client credentials flow - matching index.ts approach
async function getAuthToken() {
  try {
    console.log('Requesting authentication token...');
    
    // Build the token URL
    const tokenUrl = 'https://account.demandware.com/dwsso/oauth2/access_token';
    
    // Create form data for POST request with credentials included (client_secret_post method)
    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    // Skip setting scope so it uses the client's default scopes
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    
    // Create token request
    const response = await axios({
      method: 'post',
      url: tokenUrl,
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: formData.toString()
    });
    
    console.log(`Successfully obtained admin token with scopes: ${response.data.scope || 'not specified'}`);
    return response.data.access_token;
  } catch (error) {
    console.error('Authentication error:', error.response?.data || error.message);
    throw error;
  }
}

// Function to make OCAPI Data API request
async function makeOCAPIDataRequest(endpoint) {
  try {
    // Get authentication token
    const token = await getAuthToken();
    
    // Build proper URL, handling any double slashes
    const url = `${apiBase}/s/-/dw/data/v24_5/${endpoint}`.replace(/([^:]\/)\/+/g, "$1");
    
    console.log(`Making OCAPI Data API request to: ${url}`);
    
    const response = await axios({
      method: 'get',
      url: url,
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-dw-client-id': clientId,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('OCAPI Request Error:', error.response?.data || error.message);
    throw error;
  }
}

// Example functions to access different OCAPI Data API endpoints

// Function to fetch site details
async function fetchSites() {
  try {
    const data = await makeOCAPIDataRequest('sites');
    console.log('Sites retrieved successfully:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error fetching sites:', error.message);
  }
}

// Function to fetch products
async function fetchProducts() {
  try {
    const data = await makeOCAPIDataRequest('products?count=5');
    console.log('Products retrieved successfully:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error fetching products:', error.message);
  }
}

// Function to fetch catalogs
async function fetchCatalogs() {
  try {
    const data = await makeOCAPIDataRequest('catalogs');
    console.log('Catalogs retrieved successfully:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error fetching catalogs:', error.message);
  }
}

// Main execution
async function main() {
  console.log('SFCC OCAPI Data API Sample - Admin Access');
  console.log('----------------------------------------');
  console.log('Current Configuration:');
  console.log(`API Base URL: ${apiBase}`);
  console.log(`Organization ID: ${organizationId}`);
  console.log(`Client ID: ${clientId}`);
  console.log('----------------------------------------');
  
  try {
    // Choose which endpoint to test
    await fetchSites();
    // await fetchProducts();
    await fetchCatalogs();
  } catch (error) {
    console.error('Execution failed:', error.message);
    console.log('');
    console.log('TROUBLESHOOTING:');
    console.log('1. Verify your .env file has the correct credentials');
    console.log('2. Ensure the API client has OCAPI Data API access');
    console.log('   - OCAPI Data API permissions must be enabled in Business Manager');
    console.log('   - Client credentials need appropriate scopes');
    console.log('3. Check that API endpoints match your SFCC instance configuration');
  }
}

// Run the sample
main();

// Instructions will display after running the sample
console.log('SFCC OCAPI Data API Sample - Setup Instructions');
console.log('==============================================');
console.log('');
console.log('This sample demonstrates how to access the SFCC OCAPI Data API using');
console.log('admin client credentials. To use this script:');
console.log('');
console.log('1. CONFIGURE CREDENTIALS:');
console.log('   Update your .env file with valid credentials:');
console.log('   - SFCC_ADMIN_CLIENT_ID: Your API client ID with admin permissions');
console.log('   - SFCC_ADMIN_CLIENT_SECRET: The corresponding client secret');
console.log('   - SFCC_API_BASE: Your instance base URL');
console.log('   - SFCC_ORGANIZATION_ID: Your organization ID');
console.log('');
console.log('2. VERIFY API ACCESS:');
console.log('   - Log into Business Manager');
console.log('   - Navigate to Administration > Site Development > Open Commerce API Settings');
console.log('   - Ensure Data API is enabled for your client ID');
console.log('   - Check resource permissions for the endpoints you need');
console.log('');
console.log('3. UNCOMMENT THE EXECUTION LINE:');
console.log('   - Uncomment the "main();" line at the end of this file');
console.log('   - Choose which endpoints to test by uncommenting the corresponding function calls');
console.log('');
console.log('4. RUN THE SCRIPT:');
console.log('   - node sample-ocapi-admin.js');
console.log('');
console.log('For more information, see the SFCC OCAPI documentation:');
console.log('https://developer.salesforce.com/docs/commerce/b2c-commerce/references');