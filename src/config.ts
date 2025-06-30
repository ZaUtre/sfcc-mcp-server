import { SFCCConfig } from './types.js';
import 'dotenv/config';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: SFCCConfig;

  // Session-specific credentials storage
  private sessionCredentials: Record<string, { clientId: string; clientSecret: string; apiBase: string; ocapiVersion?: string }> = {};

  private constructor() {
    this.config = this.loadConfig();
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
  }

  public getSessionCredentials(sessionId: string) {
    return this.sessionCredentials[sessionId];
  }

  public clearSessionCredentials(sessionId: string) {
    delete this.sessionCredentials[sessionId];
  }
}

export const configManager = ConfigManager.getInstance();
