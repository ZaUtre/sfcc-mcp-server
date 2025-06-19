import fetch from "node-fetch";
import { Endpoint } from './types.js';
import { AuthService } from './auth.js';
import { configManager } from './config.js';
import { Logger } from './logger.js';

export class SFCCApiClient {
  private static instance: SFCCApiClient;
  private authService: AuthService;

  private constructor() {
    this.authService = AuthService.getInstance();
  }

  public static getInstance(): SFCCApiClient {
    if (!SFCCApiClient.instance) {
      SFCCApiClient.instance = new SFCCApiClient();
    }
    return SFCCApiClient.instance;
  }

  private replacePathParams(path: string, params: Record<string, string>): string {
    let result = path;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(`{${key}}`, value);
    }
    return result;
  }

  public async makeRequest(endpoint: Endpoint, params: Record<string, any>): Promise<any> {
    const requestId = configManager.getRequestId();
    const config = configManager.getConfig();
    
    try {
      const method = endpoint.method || 'GET';
      Logger.info(requestId, `Making SFCC API request to endpoint: ${endpoint.path} with method: ${method}`);
      
      const accessToken = await this.authService.getAuthToken();
      const path = this.replacePathParams(endpoint.path, params);
      
      let url = `${config.apiBase}/s/-/dw/data/v24_5/${path}`;
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      const pathParamMatches = endpoint.path.match(/\{([^}]+)\}/g) || [];
      const pathParamNames = pathParamMatches.map(match => match.slice(1, -1));
      
      // Extract request body for POST/PUT requests
      let requestBody = null;
      if ((method === 'POST' || method === 'PUT') && params.requestBody) {
        try {
          requestBody = typeof params.requestBody === 'object' 
            ? params.requestBody 
            : JSON.parse(params.requestBody);
          Logger.info(requestId, `Request body: ${JSON.stringify(requestBody)}`);
        } catch (e) {
          Logger.error(requestId, 'Error parsing request body', e as Error);
          throw new Error(`Invalid request body format: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
      
      // Use default request body if defined and no body provided
      if ((method === 'POST' || method === 'PUT') && !requestBody && endpoint.defaultBody) {
        requestBody = endpoint.defaultBody;
        Logger.info(requestId, `Using default request body: ${JSON.stringify(requestBody)}`);
      }
      
      // Add unused parameters as query parameters (except requestBody)
      Object.entries(params).forEach(([key, value]) => {
        if (!pathParamNames.includes(key) && key !== 'requestBody') {
          queryParams.append(key, String(value));
        }
      });
      
      // Append query parameters if any exist
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      const requestConfig: any = {
        method: method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-dw-client-id': config.adminClientId,
          'User-Agent': config.userAgent
        }
      };
      
      // Add body for POST/PUT requests
      if ((method === 'POST' || method === 'PUT') && requestBody) {
        requestConfig.headers['Content-Type'] = 'application/json';
        requestConfig.body = JSON.stringify(requestBody);
      }
      
      const response = await fetch(url, requestConfig);
      
      if (!response.ok) {
        throw new Error(`SFCC API request failed: ${response.status} ${response.statusText}`);
      }
      
      Logger.info(requestId, `SFCC API request to ${endpoint.path} completed successfully`);
      return await response.json();
    } catch (error) {
      Logger.error(requestId, `Error in SFCC API request to ${endpoint.path}`, error as Error);
      throw error;
    }
  }

  public async makeRequestWithCredentials(
    endpoint: Endpoint, 
    params: Record<string, any>, 
    credentials: { clientId: string; clientSecret: string; apiBase: string }
  ): Promise<any> {
    const requestId = configManager.getRequestId();
    
    try {
      const method = endpoint.method || 'GET';
      Logger.info(requestId, `Making SFCC API request to endpoint: ${endpoint.path} with method: ${method} (user credentials)`);
      
      // Get access token using user's credentials
      const accessToken = await this.getAccessTokenWithCredentials(credentials);
      const path = this.replacePathParams(endpoint.path, params);
      
      let url = `${credentials.apiBase}/s/-/dw/data/v24_5/${path}`;
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      const pathParamMatches = endpoint.path.match(/\{([^}]+)\}/g) || [];
      const pathParamNames = pathParamMatches.map(match => match.slice(1, -1));
      
      // Extract request body for POST/PUT requests
      let requestBody = null;
      if ((method === 'POST' || method === 'PUT') && params.requestBody) {
        try {
          requestBody = typeof params.requestBody === 'object' 
            ? params.requestBody 
            : JSON.parse(params.requestBody);
          Logger.info(requestId, `Request body: ${JSON.stringify(requestBody)}`);
        } catch (e) {
          Logger.error(requestId, 'Error parsing request body', e as Error);
          throw new Error(`Invalid request body format: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
      
      // Use default request body if defined and no body provided
      if ((method === 'POST' || method === 'PUT') && !requestBody && endpoint.defaultBody) {
        requestBody = endpoint.defaultBody;
        Logger.info(requestId, `Using default request body: ${JSON.stringify(requestBody)}`);
      }
      
      // Add unused parameters as query parameters (except requestBody)
      Object.entries(params).forEach(([key, value]) => {
        if (!pathParamNames.includes(key) && key !== 'requestBody') {
          queryParams.append(key, String(value));
        }
      });
      
      // Append query parameters if any exist
      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
      
      const requestConfig: any = {
        method: method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'x-dw-client-id': credentials.clientId,
          'User-Agent': 'sfcc-mcp-server/1.0'
        }
      };
      
      // Add body for POST/PUT requests
      if ((method === 'POST' || method === 'PUT') && requestBody) {
        requestConfig.headers['Content-Type'] = 'application/json';
        requestConfig.body = JSON.stringify(requestBody);
      }
      
      const response = await fetch(url, requestConfig);
      
      if (!response.ok) {
        throw new Error(`SFCC API request failed: ${response.status} ${response.statusText}`);
      }
      
      Logger.info(requestId, `SFCC API request to ${endpoint.path} completed successfully (user credentials)`);
      return await response.json();
    } catch (error) {
      Logger.error(requestId, `Error in SFCC API request to ${endpoint.path} (user credentials)`, error as Error);
      throw error;
    }
  }

  private async getAccessTokenWithCredentials(credentials: { clientId: string; clientSecret: string; apiBase: string }): Promise<string> {
    const requestId = configManager.getRequestId();
    
    try {
      Logger.info(requestId, 'Obtaining authentication token with user credentials');
      
      const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
      
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', credentials.clientId);
      formData.append('client_secret', credentials.clientSecret);
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });
      
      if (!response.ok) {
        let errorDetails = "";
        try {
          errorDetails = await response.text();
        } catch (e) {
          errorDetails = "Could not read error response";
        }
        
        throw new Error(`Failed to obtain admin token: ${response.status} ${response.statusText} - ${errorDetails}`);
      }
      
      const tokenData = await response.json() as any;
      
      Logger.info(requestId, 'Authentication token obtained successfully with user credentials');
      return tokenData.access_token;
    } catch (error) {
      Logger.error(requestId, 'Error obtaining authentication token with user credentials', error as Error);
      throw error;
    }
  }
}
