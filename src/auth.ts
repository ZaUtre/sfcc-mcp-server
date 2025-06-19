import fetch from "node-fetch";
import { TokenResponse } from './types.js';
import { configManager } from './config.js';
import { Logger } from './logger.js';

export class AuthService {
  private static instance: AuthService;
  private tokenCache: Record<string, { token: string; expiresAt: number }> = {};

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  public async getAuthToken(sessionId?: string): Promise<string> {
    const requestId = configManager.getRequestId();
    
    // Use session-specific cache key if sessionId is provided
    const cacheKey = sessionId || 'default';
    
    // Check if we have a valid cached token for this session
    if (this.tokenCache[cacheKey] && Date.now() < this.tokenCache[cacheKey].expiresAt) {
      Logger.info(requestId, `Using cached authentication token${sessionId ? ` for session ${sessionId}` : ''}`);
      return this.tokenCache[cacheKey].token;
    }

    try {
      Logger.info(requestId, `Attempting to obtain authentication token${sessionId ? ` for session ${sessionId}` : ''}`);
      
      const config = configManager.getConfig();
      
      // Use session-specific credentials if available
      const sessionCredentials = sessionId ? configManager.getSessionCredentials(sessionId) : null;
      const effectiveClientId = sessionCredentials?.clientId || config.adminClientId;
      const effectiveClientSecret = sessionCredentials?.clientSecret || config.adminClientSecret;
      
      const tokenUrl = `https://account.demandware.com/dwsso/oauth2/access_token`;
      
      const formData = new URLSearchParams();
      formData.append('grant_type', 'client_credentials');
      formData.append('client_id', effectiveClientId);
      formData.append('client_secret', effectiveClientSecret);
      
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
      this.tokenCache[cacheKey] = {
        token: tokenData.access_token,
        expiresAt
      };
      
      Logger.info(requestId, `Authentication token obtained successfully${sessionId ? ` for session ${sessionId}` : ''}`);
      return tokenData.access_token;
    } catch (error) {
      Logger.error(requestId, `Error obtaining authentication token${sessionId ? ` for session ${sessionId}` : ''}`, error as Error);
      throw error;
    }
  }

  public clearTokenCache(sessionId?: string): void {
    if (sessionId) {
      delete this.tokenCache[sessionId];
    } else {
      this.tokenCache = {};
    }
  }
}
