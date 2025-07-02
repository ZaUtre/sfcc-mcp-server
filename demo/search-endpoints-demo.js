#!/usr/bin/env node

/**
 * Demo script showing the new search endpoint functionality
 * 
 * This script demonstrates how the search endpoints now support
 * various search criteria instead of just returning all results.
 */

import { HandlerRegistry } from '../src/handler-registry.js';
import { Endpoint } from '../src/types.js';

// Mock the SFCC client for demo purposes
const mockSFCCClient = {
  makeRequest: async (endpoint, params, sessionId) => {
    console.log(`\n🚀 Mock API Call to ${endpoint.path}`);
    console.log(`📋 Request Body:`, JSON.stringify(params.requestBody, null, 2));
    return { 
      hits: [{ mock: 'data' }], 
      total: 1,
      query: params.requestBody?.query || 'No query specified'
    };
  }
};

// Mock dependencies
const mockConfig = { getRequestId: () => 'demo-request-id' };
const mockLogger = {
  info: (id, msg) => console.log(`ℹ️  [${id}] ${msg}`),
  error: (id, msg, err) => console.log(`❌ [${id}] ${msg}`, err)
};

// Override modules for demo
global.SFCCApiClient = { getInstance: () => mockSFCCClient };
global.configManager = mockConfig;
global.Logger = mockLogger;

async function demonstrateSearchEndpoints() {
  console.log('🔍 SFCC MCP Server - Enhanced Search Endpoints Demo\n');
  console.log('This demo shows how the search endpoints now support various search criteria.\n');

  const handlerRegistry = HandlerRegistry.getInstance();

  // Demo: Catalog Search
  console.log('=' .repeat(60));
  console.log('1. CATALOG SEARCH - Search by name and online status');
  console.log('=' .repeat(60));
  
  const catalogEndpoint = {
    path: '/catalog_search',
    method: 'POST',
    params: []
  };
  
  await handlerRegistry.executeHandler('catalog_search', catalogEndpoint, {
    catalog_name: 'Electronics Catalog',
    online_flag: true,
    count: 10
  });

  // Demo: Campaign Search
  console.log('\n' + '=' .repeat(60));
  console.log('2. CAMPAIGN SEARCH - Search by name, enabled status, and customer groups');
  console.log('=' .repeat(60));
  
  const campaignEndpoint = {
    path: '/sites/{site_id}/campaign_search',
    method: 'POST',
    params: []
  };
  
  await handlerRegistry.executeHandler('campaign_search', campaignEndpoint, {
    site_id: 'SiteGenesis',
    campaign_name: 'Summer Sale',
    enabled: true,
    customer_groups: 'VIP,PREMIUM',
    count: 5
  });

  // Demo: Promotion Search
  console.log('\n' + '=' .repeat(60));
  console.log('3. PROMOTION SEARCH - Search by promotion class and enabled status');
  console.log('=' .repeat(60));
  
  const promotionEndpoint = {
    path: '/sites/{site_id}/promotion_search',
    method: 'POST',
    params: []
  };
  
  await handlerRegistry.executeHandler('promotion_search', promotionEndpoint, {
    site_id: 'SiteGenesis',
    promotion_class: 'product',
    enabled: true,
    count: 15
  });

  // Demo: Coupon Search
  console.log('\n' + '=' .repeat(60));
  console.log('4. COUPON SEARCH - Search by code pattern and single use flag');
  console.log('=' .repeat(60));
  
  const couponEndpoint = {
    path: '/sites/{site_id}/coupon_search',
    method: 'POST',
    params: []
  };
  
  await handlerRegistry.executeHandler('coupon_search', couponEndpoint, {
    site_id: 'SiteGenesis',
    coupon_code: 'SAVE20',
    single_use: false,
    enabled: true
  });

  // Demo: Custom Objects Search
  console.log('\n' + '=' .repeat(60));
  console.log('5. CUSTOM OBJECTS SEARCH - Search by key pattern and custom field');
  console.log('=' .repeat(60));
  
  const customObjectsEndpoint = {
    path: '/custom_objects/{object_type}',
    method: 'POST',
    params: []
  };
  
  await handlerRegistry.executeHandler('custom_objects_search', customObjectsEndpoint, {
    object_type: 'SitePreferences',
    key_pattern: 'config_*',
    custom_field: 'environment:production'
  });

  // Demo: Fallback to match_all
  console.log('\n' + '=' .repeat(60));
  console.log('6. FALLBACK BEHAVIOR - When no search criteria provided');
  console.log('=' .repeat(60));
  
  await handlerRegistry.executeHandler('catalog_search', catalogEndpoint, {});

  console.log('\n✅ Demo completed! All search endpoints now support meaningful search criteria.');
  console.log('\n📝 Summary of improvements:');
  console.log('   • catalog_search: Search by name, ID, online status');
  console.log('   • campaign_search: Search by name, ID, enabled status, customer groups');
  console.log('   • promotion_search: Search by name, ID, enabled status, promotion class');
  console.log('   • coupon_search: Search by code, ID, enabled status, single use flag');
  console.log('   • custom_objects_search: Search by key patterns and custom fields');
  console.log('   • All endpoints support pagination (count, start)');
  console.log('   • Consistent query structure using SFCC OCAPI query format');
  console.log('   • Fallback to match_all_query when no criteria provided');
}

// Run the demo
demonstrateSearchEndpoints().catch(console.error);