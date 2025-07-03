import { Endpoint, CustomHandler, SearchQuery } from './types.js';
import { SFCCApiClient } from './sfcc-client.js';
import { configManager } from './config.js';
import { Logger } from './logger.js';

export class HandlerRegistry {
  private static instance: HandlerRegistry;
  private handlers = new Map<string, CustomHandler>();
  private sfccClient: SFCCApiClient;

  private constructor() {
    this.sfccClient = SFCCApiClient.getInstance();
    this.registerDefaultHandlers();
  }

  public static getInstance(): HandlerRegistry {
    if (!HandlerRegistry.instance) {
      HandlerRegistry.instance = new HandlerRegistry();
    }
    return HandlerRegistry.instance;
  }

  public registerHandler(toolName: string, handler: CustomHandler): void {
    this.handlers.set(toolName, handler);
  }

  public hasHandler(toolName: string): boolean {
    return this.handlers.has(toolName);
  }
  public async executeHandler(toolName: string, endpoint: Endpoint, params: Record<string, any>, sessionId?: string): Promise<any> {
    const handler = this.handlers.get(toolName);
    if (handler) {
      return await handler(endpoint, params, sessionId);
    }
    
    // Fall back to default SFCC client with session support
    return await this.sfccClient.makeRequest(endpoint, params, sessionId);
  }

  private registerDefaultHandlers(): void {
    // Register the product search handler
    this.registerHandler('product_search', this.createProductSearchHandler());
    
    // Register other search handlers
    this.registerHandler('catalog_search', this.createCatalogSearchHandler());
    this.registerHandler('campaign_search', this.createCampaignSearchHandler());
    this.registerHandler('promotion_search', this.createPromotionSearchHandler());
    this.registerHandler('coupon_search', this.createCouponSearchHandler());
    this.registerHandler('custom_objects_search', this.createCustomObjectsSearchHandler());
  }

  private createProductSearchHandler(): CustomHandler {
    return async (endpoint: Endpoint, params: Record<string, any>, sessionId?: string) => {
      const requestId = configManager.getRequestId();
      
      try {
        Logger.info(requestId, `Custom handler for ${endpoint.path} called with params: ${JSON.stringify(params)}`);
        
        const searchQuery: SearchQuery = {};
        const mustQueries: any[] = [];

        let hasOtherFilters = false;
        let hasPriceFilter = params.min_price || params.max_price;

        if (params.product_name) {
          mustQueries.push({
            text_query: {
              fields: ["name"],
              search_phrase: params.product_name
            }
          });
          Logger.info(requestId, `Added text search query for product name: ${params.product_name}`);
          hasOtherFilters = true;
        }

        if (params.category_id) {
          mustQueries.push({
            term_query: {
              fields: ["primary_category_id"],
              operator: "is",
              values: [params.category_id]
            }
          });
          Logger.info(requestId, `Added category filter for category_id: ${params.category_id}`);
          hasOtherFilters = true;
        }

        // Handle price filter as top-level range_query if it's the only filter
        if (hasPriceFilter && !hasOtherFilters) {
          const rangeQuery: any = { field: "price" };
          if (params.min_price) {
            rangeQuery.from = parseFloat(params.min_price);
          }
          if (params.max_price) {
            rangeQuery.to = parseFloat(params.max_price);
          }
          searchQuery.query = { range_query: rangeQuery };
          Logger.info(requestId, `Added top-level price range query: min=${params.min_price || 'N/A'}, max=${params.max_price || 'N/A'}`);
        } else if (mustQueries.length > 0 || hasPriceFilter) {
          // If there are other filters, add price as a must query
          if (hasPriceFilter) {
            const rangeQuery: any = { field: "price" };
            if (params.min_price) {
              rangeQuery.from = parseFloat(params.min_price);
            }
            if (params.max_price) {
              rangeQuery.to = parseFloat(params.max_price);
            }
            mustQueries.push({ range_query: rangeQuery });
            Logger.info(requestId, `Added price range query to must: min=${params.min_price || 'N/A'}, max=${params.max_price || 'N/A'}`);
          }
          searchQuery.query = {
            bool_query: {
              must: mustQueries
            }
          };
        } else {
          searchQuery.query = {
            match_all_query: {}
          };
          Logger.info(requestId, 'No specific search criteria provided, using match_all query');
        }
          // Handle expand parameter
        if (params.expand) {
          searchQuery.expand = params.expand.split(',').map((item: string) => item.trim());
          Logger.info(requestId, `Using custom expand fields: ${searchQuery.expand?.join(', ')}`);
        } // else do not set expand at all
        
        // Handle inventory_ids parameter
        if (params.inventory_ids) {
          searchQuery.inventory_ids = params.inventory_ids.split(',').map((id: string) => id.trim());
          Logger.info(requestId, `Added inventory_ids filter: ${searchQuery.inventory_ids?.join(', ')}`);
        }
        
        // Handle pagination parameters
        if (params.count) {
          searchQuery.count = parseInt(params.count);
          Logger.info(requestId, `Set results count to: ${searchQuery.count}`);
        }
        
        if (params.start) {
          searchQuery.start = parseInt(params.start);
          Logger.info(requestId, `Set pagination start to: ${searchQuery.start}`);
        }

        searchQuery.select = "(**)";
        
        // Set the request body in params
        params.requestBody = searchQuery;
        
        // Use the SFCC client to make the request
        return await this.sfccClient.makeRequest(endpoint, params, sessionId);
      } catch (error) {
        Logger.error(requestId, 'Error in product search handler', error as Error);
        throw error;
      }
    };
  }

  /**
   * Creates a reusable search handler with common functionality
   */
  private createBaseSearchHandler(searchConfig: {
    entityType: string;
    searchFields: { [key: string]: string[] };
    termFields: { [key: string]: { fields: string[], operator?: string } };
    booleanFields?: { [key: string]: string[] };
  }): CustomHandler {
    return async (endpoint: Endpoint, params: Record<string, any>, sessionId?: string) => {
      const requestId = configManager.getRequestId();
      
      try {
        Logger.info(requestId, `Custom ${searchConfig.entityType} search handler called with params: ${JSON.stringify(params)}`);
        
        const searchQuery: SearchQuery = {};
        const mustQueries: any[] = [];

        // Handle text search fields
        for (const [paramName, fields] of Object.entries(searchConfig.searchFields)) {
          if (params[paramName]) {
            mustQueries.push({
              text_query: {
                fields: fields,
                search_phrase: params[paramName]
              }
            });
            Logger.info(requestId, `Added text search query for ${paramName}: ${params[paramName]}`);
          }
        }

        // Handle term search fields (exact matches)
        for (const [paramName, config] of Object.entries(searchConfig.termFields)) {
          if (params[paramName]) {
            mustQueries.push({
              term_query: {
                fields: config.fields,
                operator: config.operator || "is",
                values: [params[paramName]]
              }
            });
            Logger.info(requestId, `Added term query for ${paramName}: ${params[paramName]}`);
          }
        }

        // Handle boolean fields
        if (searchConfig.booleanFields) {
          for (const [paramName, fields] of Object.entries(searchConfig.booleanFields)) {
            if (params[paramName] !== undefined) {
              const boolValue = params[paramName] === true || params[paramName] === 'true';
              mustQueries.push({
                term_query: {
                  fields: fields,
                  operator: "is",
                  values: [boolValue.toString()]
                }
              });
              Logger.info(requestId, `Added boolean query for ${paramName}: ${boolValue}`);
            }
          }
        }

        // Set query based on filters
        if (mustQueries.length > 0) {
          searchQuery.query = {
            bool_query: {
              must: mustQueries
            }
          };
        } else {
          searchQuery.query = {
            match_all_query: {}
          };
          Logger.info(requestId, `No specific search criteria provided for ${searchConfig.entityType}, using match_all query`);
        }

        // Handle pagination parameters
        if (params.count) {
          searchQuery.count = parseInt(params.count);
          Logger.info(requestId, `Set results count to: ${searchQuery.count}`);
        }
        
        if (params.start) {
          searchQuery.start = parseInt(params.start);
          Logger.info(requestId, `Set pagination start to: ${searchQuery.start}`);
        }

        searchQuery.select = "(**)";
        
        // Set the request body in params
        params.requestBody = searchQuery;
        
        // Use the SFCC client to make the request
        return await this.sfccClient.makeRequest(endpoint, params, sessionId);
      } catch (error) {
        Logger.error(requestId, `Error in ${searchConfig.entityType} search handler`, error as Error);
        throw error;
      }
    };
  }

  private createCatalogSearchHandler(): CustomHandler {
    return this.createBaseSearchHandler({
      entityType: 'catalog',
      searchFields: {
        'catalog_name': ['name']
      },
      termFields: {
        'catalog_id': { fields: ['id'] }
      },
      booleanFields: {
        'online_flag': ['online_flag']
      }
    });
  }

  private createCampaignSearchHandler(): CustomHandler {
    return async (endpoint: Endpoint, params: Record<string, any>, sessionId?: string) => {
      const requestId = configManager.getRequestId();
      
      try {
        Logger.info(requestId, `Custom campaign search handler called with params: ${JSON.stringify(params)}`);
        
        const searchQuery: SearchQuery = {};
        const mustQueries: any[] = [];

        // Handle campaign name search
        if (params.campaign_name) {
          mustQueries.push({
            text_query: {
              fields: ["name"],
              search_phrase: params.campaign_name
            }
          });
          Logger.info(requestId, `Added text search query for campaign name: ${params.campaign_name}`);
        }

        // Handle campaign ID search
        if (params.campaign_id) {
          mustQueries.push({
            term_query: {
              fields: ["id"],
              operator: "is",
              values: [params.campaign_id]
            }
          });
          Logger.info(requestId, `Added term query for campaign ID: ${params.campaign_id}`);
        }

        // Handle enabled status
        if (params.enabled !== undefined) {
          const boolValue = params.enabled === true || params.enabled === 'true';
          mustQueries.push({
            term_query: {
              fields: ["enabled"],
              operator: "is",
              values: [boolValue.toString()]
            }
          });
          Logger.info(requestId, `Added enabled query: ${boolValue}`);
        }

        // Handle customer groups (comma-separated list)
        if (params.customer_groups) {
          const customerGroupIds = params.customer_groups.split(',').map((id: string) => id.trim());
          mustQueries.push({
            term_query: {
              fields: ["customer_groups"],
              operator: "one_of",
              values: customerGroupIds
            }
          });
          Logger.info(requestId, `Added customer groups filter: ${customerGroupIds.join(', ')}`);
        }

        // Set query based on filters
        if (mustQueries.length > 0) {
          searchQuery.query = {
            bool_query: {
              must: mustQueries
            }
          };
        } else {
          searchQuery.query = {
            match_all_query: {}
          };
          Logger.info(requestId, 'No specific search criteria provided for campaigns, using match_all query');
        }

        // Handle pagination parameters
        if (params.count) {
          searchQuery.count = parseInt(params.count);
          Logger.info(requestId, `Set results count to: ${searchQuery.count}`);
        }
        
        if (params.start) {
          searchQuery.start = parseInt(params.start);
          Logger.info(requestId, `Set pagination start to: ${searchQuery.start}`);
        }

        searchQuery.select = "(**)";
        
        // Set the request body in params
        params.requestBody = searchQuery;
        
        // Use the SFCC client to make the request
        return await this.sfccClient.makeRequest(endpoint, params, sessionId);
      } catch (error) {
        Logger.error(requestId, 'Error in campaign search handler', error as Error);
        throw error;
      }
    };
  }

  private createPromotionSearchHandler(): CustomHandler {
    return this.createBaseSearchHandler({
      entityType: 'promotion',
      searchFields: {
        'promotion_name': ['name']
      },
      termFields: {
        'promotion_id': { fields: ['id'] },
        'promotion_class': { fields: ['promotion_class'] }
      },
      booleanFields: {
        'enabled': ['enabled']
      }
    });
  }

  private createCouponSearchHandler(): CustomHandler {
    return this.createBaseSearchHandler({
      entityType: 'coupon',
      searchFields: {
        'coupon_code': ['code']
      },
      termFields: {
        'coupon_id': { fields: ['id'] }
      },
      booleanFields: {
        'enabled': ['enabled'],
        'single_use': ['single_use']
      }
    });
  }

  private createCustomObjectsSearchHandler(): CustomHandler {
    return async (endpoint: Endpoint, params: Record<string, any>, sessionId?: string) => {
      const requestId = configManager.getRequestId();
      
      try {
        Logger.info(requestId, `Custom objects search handler called with params: ${JSON.stringify(params)}`);
        
        const searchQuery: SearchQuery = {};
        const mustQueries: any[] = [];

        // Handle key pattern search
        if (params.key_pattern) {
          // Use prefix query if it ends with *, otherwise use term query
          if (params.key_pattern.endsWith('*')) {
            const prefix = params.key_pattern.slice(0, -1);
            mustQueries.push({
              prefix_query: {
                field: "key",
                prefix: prefix
              }
            });
            Logger.info(requestId, `Added prefix query for key pattern: ${prefix}`);
          } else {
            mustQueries.push({
              term_query: {
                fields: ["key"],
                operator: "is",
                values: [params.key_pattern]
              }
            });
            Logger.info(requestId, `Added term query for key: ${params.key_pattern}`);
          }
        }

        // Handle custom field search (format: field_name:value)
        if (params.custom_field) {
          const [fieldName, fieldValue] = params.custom_field.split(':', 2);
          if (fieldName && fieldValue) {
            mustQueries.push({
              term_query: {
                fields: [fieldName],
                operator: "is",
                values: [fieldValue]
              }
            });
            Logger.info(requestId, `Added custom field query for ${fieldName}: ${fieldValue}`);
          }
        }

        // Set query based on filters
        if (mustQueries.length > 0) {
          searchQuery.query = {
            bool_query: {
              must: mustQueries
            }
          };
        } else {
          searchQuery.query = {
            match_all_query: {}
          };
          Logger.info(requestId, 'No specific search criteria provided for custom objects, using match_all query');
        }

        // Handle pagination parameters
        if (params.count) {
          searchQuery.count = parseInt(params.count);
          Logger.info(requestId, `Set results count to: ${searchQuery.count}`);
        }
        
        if (params.start) {
          searchQuery.start = parseInt(params.start);
          Logger.info(requestId, `Set pagination start to: ${searchQuery.start}`);
        }

        searchQuery.select = "(**)";
        
        // Set the request body in params
        params.requestBody = searchQuery;
        
        // Use the SFCC client to make the request
        return await this.sfccClient.makeRequest(endpoint, params, sessionId);
      } catch (error) {
        Logger.error(requestId, 'Error in custom objects search handler', error as Error);
        throw error;
      }
    };
  }
}