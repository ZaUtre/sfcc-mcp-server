import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { SFCCConfig } from './types.js';

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

export class ConfigManager {
  private static instance: ConfigManager;
  private config: SFCCConfig;

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

    if (!adminClientId || !adminClientSecret || !apiBase) {
      throw new Error("Missing required SFCC configuration. Please check your .env file.");
    }

    return {
      adminClientId,
      adminClientSecret,
      apiBase,
      userAgent: "sfcc-mcp-server/1.0"
    };
  }

  public getConfig(): SFCCConfig {
    return this.config;
  }

  public getRequestId(): string {
    return process.env.REQUEST_ID || 'default-request';
  }
}

export const configManager = ConfigManager.getInstance();
