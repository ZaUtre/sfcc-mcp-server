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
      return await handler(endpoint, params);
    }
    
    // Fall back to default SFCC client with session support
    return await this.sfccClient.makeRequest(endpoint, params, sessionId);
  }

  private registerDefaultHandlers(): void {
    // Register the product search handler
    this.registerHandler('product_search', this.createProductSearchHandler());
  }

  private createProductSearchHandler(): CustomHandler {
    return async (endpoint: Endpoint, params: Record<string, any>) => {
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
        return await this.sfccClient.makeRequest(endpoint, params);
      } catch (error) {
        Logger.error(requestId, 'Error in product search handler', error as Error);
        throw error;
      }
    };
  }
}