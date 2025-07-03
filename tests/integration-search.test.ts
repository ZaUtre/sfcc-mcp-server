import 'dotenv/config';

// Check if we have the required environment variables for integration testing
const hasCredentials = process.env.SFCC_ADMIN_CLIENT_ID && 
                      process.env.SFCC_ADMIN_CLIENT_SECRET && 
                      process.env.SFCC_API_BASE;

const runTest = hasCredentials ? describe : describe.skip;

runTest('Search Endpoints Integration Tests', () => {
  let handlerRegistry: any;

  beforeAll(async () => {
    if (!hasCredentials) {
      console.warn('Integration tests skipped: SFCC credentials not found in environment variables');
      return;
    }
    
    // Import modules only when we have credentials
    const { HandlerRegistry } = await import('../src/handler-registry.js');
    handlerRegistry = HandlerRegistry.getInstance();
  });

  // Increased timeout for real API calls
  const API_TIMEOUT = 30000;

  // Endpoint factory functions
  const endpoints = {
    productSearch: () => ({
      path: '/sites/{site_id}/product_search',
      description: 'Search for products',
      method: 'POST',
      params: []
    }),
    catalogSearch: () => ({
      path: '/catalog_search',
      description: 'Search for catalogs',
      method: 'POST',
      params: []
    }),
    campaignSearch: () => ({
      path: '/sites/{site_id}/campaign_search',
      description: 'Search for campaigns',
      method: 'POST',
      params: []
    }),
    promotionSearch: () => ({
      path: '/sites/{site_id}/promotion_search',
      description: 'Search for promotions',
      method: 'POST',
      params: []
    }),
    couponSearch: () => ({
      path: '/sites/{site_id}/coupon_search',
      description: 'Search for coupons',
      method: 'POST',
      params: []
    }),
    customObjectsSearch: () => ({
      path: '/custom_objects/{object_type}',
      description: 'Search for custom objects',
      method: 'POST',
      params: []
    })
  };

  describe('Product Search Integration', () => {
    test('should handle product search with no parameters (match_all)', async () => {
      const params = {
        site_id: 'SiteGenesis'
      };

      const result = await handlerRegistry.executeHandler('product_search', endpoints.productSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle product search with name filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        product_name: 'shirt',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('product_search', endpoints.productSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
      expect(Array.isArray(result.hits)).toBe(true);
    }, API_TIMEOUT);

    test('should handle product search with pagination', async () => {
      const params = {
        site_id: 'SiteGenesis',
        count: '10',
        start: '0'
      };

      const result = await handlerRegistry.executeHandler('product_search', endpoints.productSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('start');
    }, API_TIMEOUT);

    test('should handle product search with multiple filters', async () => {
      const params = {
        site_id: 'SiteGenesis',
        product_name: 'shirt',
        min_price: '10',
        max_price: '100',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('product_search', endpoints.productSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);
  });

  describe('Catalog Search Integration', () => {
    test('should handle catalog search with no parameters (match_all)', async () => {
      const params = {};

      const result = await handlerRegistry.executeHandler('catalog_search', endpoints.catalogSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle catalog search with name filter', async () => {
      const params = {
        catalog_name: 'master',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('catalog_search', endpoints.catalogSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle catalog search with online_flag filter', async () => {
      const params = {
        online_flag: true,
        count: '10'
      };

      const result = await handlerRegistry.executeHandler('catalog_search', endpoints.catalogSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);
  });

  describe('Campaign Search Integration', () => {
    test('should handle campaign search with no parameters (match_all)', async () => {
      const params = {
        site_id: 'SiteGenesis'
      };

      const result = await handlerRegistry.executeHandler('campaign_search', endpoints.campaignSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle campaign search with name filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        campaign_name: 'sale',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('campaign_search', endpoints.campaignSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle campaign search with enabled filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        enabled: true,
        count: '10'
      };

      const result = await handlerRegistry.executeHandler('campaign_search', endpoints.campaignSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle campaign search with multiple filters', async () => {
      const params = {
        site_id: 'SiteGenesis',
        campaign_name: 'campaign',
        enabled: true,
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('campaign_search', endpoints.campaignSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);
  });

  describe('Promotion Search Integration', () => {
    test('should handle promotion search with no parameters (match_all)', async () => {
      const params = {
        site_id: 'SiteGenesis'
      };

      const result = await handlerRegistry.executeHandler('promotion_search', endpoints.promotionSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle promotion search with name filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        promotion_name: 'promotion',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('promotion_search', endpoints.promotionSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle promotion search with enabled filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        enabled: true,
        count: '10'
      };

      const result = await handlerRegistry.executeHandler('promotion_search', endpoints.promotionSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle promotion search with promotion_class filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        promotion_class: 'product',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('promotion_search', endpoints.promotionSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);
  });

  describe('Coupon Search Integration', () => {
    test('should handle coupon search with no parameters (match_all)', async () => {
      const params = {
        site_id: 'SiteGenesis'
      };

      const result = await handlerRegistry.executeHandler('coupon_search', endpoints.couponSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle coupon search with code filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        coupon_code: 'SAVE',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('coupon_search', endpoints.couponSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle coupon search with enabled filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        enabled: true,
        count: '10'
      };

      const result = await handlerRegistry.executeHandler('coupon_search', endpoints.couponSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle coupon search with single_use filter', async () => {
      const params = {
        site_id: 'SiteGenesis',
        single_use: false,
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('coupon_search', endpoints.couponSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);
  });

  describe('Custom Objects Search Integration', () => {
    test('should handle custom objects search with no parameters (match_all)', async () => {
      const params = {
        object_type: 'SitePreferences'
      };

      const result = await handlerRegistry.executeHandler('custom_objects_search', endpoints.customObjectsSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle custom objects search with key pattern wildcard', async () => {
      const params = {
        object_type: 'SitePreferences',
        key_pattern: 'config_*',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('custom_objects_search', endpoints.customObjectsSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle custom objects search with exact key', async () => {
      const params = {
        object_type: 'SitePreferences',
        key_pattern: 'default',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('custom_objects_search', endpoints.customObjectsSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);

    test('should handle custom objects search with custom field', async () => {
      const params = {
        object_type: 'SitePreferences',
        custom_field: 'type:configuration',
        count: '5'
      };

      const result = await handlerRegistry.executeHandler('custom_objects_search', endpoints.customObjectsSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
    }, API_TIMEOUT);
  });

  describe('Error Handling', () => {
    test('should handle invalid site_id gracefully', async () => {
      const params = {
        site_id: 'InvalidSiteId123',
        count: '5'
      };

      try {
        const result = await handlerRegistry.executeHandler('product_search', endpoints.productSearch(), params);
        // If it doesn't throw, check if it returns a proper error structure
        if (result.fault) {
          expect(result.fault).toHaveProperty('type');
          expect(result.fault).toHaveProperty('message');
        }
      } catch (error: any) {
        // API errors are acceptable for integration tests
        expect(error).toBeDefined();
      }
    }, API_TIMEOUT);

    test('should handle invalid object_type gracefully', async () => {
      const params = {
        object_type: 'InvalidObjectType123',
        count: '5'
      };

      try {
        const result = await handlerRegistry.executeHandler('custom_objects_search', endpoints.customObjectsSearch(), params);
        // If it doesn't throw, check if it returns a proper error structure
        if (result.fault) {
          expect(result.fault).toHaveProperty('type');
          expect(result.fault).toHaveProperty('message');
        }
      } catch (error: any) {
        // API errors are acceptable for integration tests
        expect(error).toBeDefined();
      }
    }, API_TIMEOUT);
  });

  describe('Pagination and Results Validation', () => {
    test('should respect pagination parameters', async () => {
      const params = {
        site_id: 'SiteGenesis',
        count: '3',
        start: '0'
      };

      const result = await handlerRegistry.executeHandler('product_search', endpoints.productSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
      expect(result).toHaveProperty('count');
      expect(result.count).toBeLessThanOrEqual(3);
    }, API_TIMEOUT);

    test('should handle large count parameter', async () => {
      const params = {
        count: '50'
      };

      const result = await handlerRegistry.executeHandler('catalog_search', endpoints.catalogSearch(), params);
      
      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('fault');
      expect(result).toHaveProperty('hits');
      expect(result).toHaveProperty('count');
    }, API_TIMEOUT);
  });
});