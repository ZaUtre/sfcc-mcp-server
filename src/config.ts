import { SFCCConfig } from './types.js';
import { sessionPersistence } from './session-persistence.js';
import 'dotenv/config';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: SFCCConfig;

  // Session-specific credentials storage
  private sessionCredentials: Record<string, { clientId: string; clientSecret: string; apiBase: string; ocapiVersion?: string }> = {};

  private constructor() {
    this.config = this.loadConfig();
    this.restoreSessionCredentials();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): SFCCConfig {
    const adminClientId = process.env.SFCC_ADMIN_CLIENT_ID || "";
    const adminClientSecret = process.env.SFCC_ADMIN_CLIENT_SECRET || "";
    const apiBase = process.env.SFCC_API_BASE || "";
    const ocapiVersion = process.env.OCAPI_VERSION || "v24_5";

    if (!adminClientId || !adminClientSecret || !apiBase) {
      throw new Error("Missing required SFCC configuration. Please check your .env file.");
    }

    return {
      adminClientId,
      adminClientSecret,
      apiBase,
      userAgent: "sfcc-mcp-server/1.0",
      ocapiVersion
    };
  }

  public getConfig(): SFCCConfig {
    return this.config;
  }

  public getRequestId(): string {
    return process.env.REQUEST_ID || 'default-request';
  }

  public setSessionCredentials(sessionId: string, credentials: { clientId: string; clientSecret: string; apiBase: string; ocapiVersion?: string }) {
    this.sessionCredentials[sessionId] = credentials;
    this.persistSessionCredentials();
  }

  public getSessionCredentials(sessionId: string) {
    return this.sessionCredentials[sessionId];
  }

  public clearSessionCredentials(sessionId: string) {
    delete this.sessionCredentials[sessionId];
    this.persistSessionCredentials();
  }

  private restoreSessionCredentials(): void {
    try {
      const sessionData = sessionPersistence.loadSessionData();
      if (sessionData && sessionData.sessionCredentials) {
        this.sessionCredentials = sessionData.sessionCredentials;
      }
    } catch (error) {
      // Ignore errors during restoration - start with empty sessions
    }
  }

  private persistSessionCredentials(): void {
    try {
      const existingData = sessionPersistence.loadSessionData() || {
        sessionCredentials: {},
        userCredentials: {},
        authCodes: {},
        timestamp: Date.now()
      };
      
      sessionPersistence.saveSessionData({
        ...existingData,
        sessionCredentials: this.sessionCredentials
      });
    } catch (error) {
      // Ignore persistence errors - continue operating normally
    }
  }
}

export const configManager = ConfigManager.getInstance();
