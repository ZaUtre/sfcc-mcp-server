import fetch from "node-fetch";
import { TokenResponse } from './types.js';
import { configManager } from './config.js';
import { Logger } from './logger.js';

export class AuthService {
  private static instance: AuthService;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async getAuthToken(): Promise<string> {
    const requestId = configManager.getRequestId();
    
    // Check if we have a valid cached token
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      Logger.info(requestId, 'Using cached authentication token');
      return this.tokenCache.token;
    }

    try {
      Logger.info(requestId, 'Attempting to obtain authentication token');
      
      const config = configManager.getConfig();
      const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
      
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', config.adminClientId);
      formData.append('client_secret', config.adminClientSecret);
      
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
      
      const tokenData = await response.json() as TokenResponse;
      
      // Cache the token with a buffer time (subtract 5 minutes from expires_in)
      const expiresAt = Date.now() + (tokenData.expires_in - 300) * 1000;
      this.tokenCache = {
        token: tokenData.access_token,
        expiresAt
      };
      
      Logger.info(requestId, 'Authentication token obtained successfully');
      return tokenData.access_token;
    } catch (error) {
      Logger.error(requestId, 'Error obtaining authentication token', error as Error);
      throw error;
    }
  }

  public clearTokenCache(): void {
    this.tokenCache = null;
  }
}
