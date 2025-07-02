import { HandlerRegistry } from '../src/handler-registry.js';
import { Endpoint } from '../src/types.js';

// Mock the SFCC client to avoid configuration requirements
jest.mock('../src/sfcc-client.js', () => ({
  SFCCApiClient: {
    getInstance: jest.fn().mockReturnValue({
      makeRequest: jest.fn().mockResolvedValue({ mock: 'response' })
    })
  }
}));

// Mock the config manager
jest.mock('../src/config.js', () => ({
  configManager: {
    getRequestId: jest.fn().mockReturnValue('test-request-id')
  }
}));

// Mock the logger
jest.mock('../src/logger.js', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('Search Handlers', () => {
  let handlerRegistry: HandlerRegistry;

  beforeEach(() => {
    handlerRegistry = HandlerRegistry.getInstance();
  });

  test('should register all search handlers', () => {
    const searchEndpoints = [
      'product_search',
      'catalog_search',
      'campaign_search',
      'promotion_search',
      'coupon_search',
      'custom_objects_search'
    ];

    searchEndpoints.forEach(toolName => {
      expect(handlerRegistry.hasHandler(toolName)).toBe(true);
    });
  });

  test('catalog_search handler should create proper query for name search', async () => {
    const mockEndpoint: Endpoint = {
      path: '/catalog_search',
      description: 'Test catalog search',
      method: 'POST',
      params: []
    };

    const params: Record<string, any> = {
      catalog_name: 'test catalog'
    };

    const result = await handlerRegistry.executeHandler('catalog_search', mockEndpoint, params);

    expect(params.requestBody).toBeDefined();
    expect(params.requestBody.query).toBeDefined();
    expect(params.requestBody.query.bool_query).toBeDefined();
    expect(params.requestBody.query.bool_query.must).toEqual([
      {
        text_query: {
          fields: ['name'],
          search_phrase: 'test catalog'
        }
      }
    ]);
  });

  test('campaign_search handler should create proper query for multiple filters', async () => {
    const mockEndpoint: Endpoint = {
      path: '/sites/{site_id}/campaign_search',
      description: 'Test campaign search',
      method: 'POST',
      params: []
    };

    const params: Record<string, any> = {
      site_id: 'test_site',
      campaign_name: 'summer sale',
      enabled: true,
      customer_groups: 'VIP,PREMIUM'
    };

    const result = await handlerRegistry.executeHandler('campaign_search', mockEndpoint, params);

    expect(params.requestBody).toBeDefined();
    expect(params.requestBody.query.bool_query.must).toHaveLength(3);
    expect(params.requestBody.query.bool_query.must).toContainEqual({
      text_query: {
        fields: ['name'],
        search_phrase: 'summer sale'
      }
    });
    expect(params.requestBody.query.bool_query.must).toContainEqual({
      term_query: {
        fields: ['enabled'],
        operator: 'is',
        values: ['true']
      }
    });
    expect(params.requestBody.query.bool_query.must).toContainEqual({
      term_query: {
        fields: ['customer_groups'],
        operator: 'one_of',
        values: ['VIP', 'PREMIUM']
      }
    });
  });

  test('custom_objects_search handler should handle key pattern with wildcards', async () => {
    const mockEndpoint: Endpoint = {
      path: '/custom_objects/{object_type}',
      description: 'Test custom objects search',
      method: 'POST',
      params: []
    };

    const params: Record<string, any> = {
      object_type: 'CustomConfig',
      key_pattern: 'config_*'
    };

    const result = await handlerRegistry.executeHandler('custom_objects_search', mockEndpoint, params);

    expect(params.requestBody.query.bool_query.must).toEqual([
      {
        prefix_query: {
          field: 'key',
          prefix: 'config_'
        }
      }
    ]);
  });

  test('custom_objects_search handler should handle custom field search', async () => {
    const mockEndpoint: Endpoint = {
      path: '/custom_objects/{object_type}',
      description: 'Test custom objects search',
      method: 'POST',
      params: []
    };

    const params: Record<string, any> = {
      object_type: 'CustomConfig',
      custom_field: 'status:active'
    };

    const result = await handlerRegistry.executeHandler('custom_objects_search', mockEndpoint, params);

    expect(params.requestBody.query.bool_query.must).toEqual([
      {
        term_query: {
          fields: ['status'],
          operator: 'is',
          values: ['active']
        }
      }
    ]);
  });

  test('promotion_search handler should handle promotion class filter', async () => {
    const mockEndpoint: Endpoint = {
      path: '/sites/{site_id}/promotion_search',
      description: 'Test promotion search',
      method: 'POST',
      params: []
    };

    const params: Record<string, any> = {
      site_id: 'test_site',
      promotion_class: 'product'
    };

    const result = await handlerRegistry.executeHandler('promotion_search', mockEndpoint, params);

    expect(params.requestBody.query.bool_query.must).toEqual([
      {
        term_query: {
          fields: ['promotion_class'],
          operator: 'is',
          values: ['product']
        }
      }
    ]);
  });

  test('search handlers should fall back to match_all when no filters provided', async () => {
    const mockEndpoint: Endpoint = {
      path: '/catalog_search',
      description: 'Test catalog search',
      method: 'POST',
      params: []
    };

    const params: Record<string, any> = {};

    const result = await handlerRegistry.executeHandler('catalog_search', mockEndpoint, params);

    expect(params.requestBody.query).toEqual({
      match_all_query: {}
    });
  });

  test('search handlers should handle pagination parameters', async () => {
    const mockEndpoint: Endpoint = {
      path: '/catalog_search',
      description: 'Test catalog search',
      method: 'POST',
      params: []
    };

    const params: Record<string, any> = {
      count: '10',
      start: '5'
    };

    const result = await handlerRegistry.executeHandler('catalog_search', mockEndpoint, params);

    expect(params.requestBody.count).toBe(10);
    expect(params.requestBody.start).toBe(5);
    expect(params.requestBody.select).toBe('(**)');
  });
});