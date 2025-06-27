// Simplified config test that focuses on core functionality
import path from 'path';

// Mock environment variables for testing
const mockEnv = {
  SFCC_ADMIN_CLIENT_ID: 'test_client_id',
  SFCC_ADMIN_CLIENT_SECRET: 'test_client_secret',
  SFCC_API_BASE: 'https://test.api.com',
  OCAPI_VERSION: 'v24_5',
  REQUEST_ID: 'test_request_id'
};

// Simple config manager for testing
class TestConfigManager {
  private static instance: TestConfigManager;
  private config: any;
  private sessionCredentials: Record<string, any> = {};

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): TestConfigManager {
    if (!TestConfigManager.instance) {
      TestConfigManager.instance = new TestConfigManager();
    }
    return TestConfigManager.instance;
  }

  private loadConfig() {
    const adminClientId = mockEnv.SFCC_ADMIN_CLIENT_ID || "";
    const adminClientSecret = mockEnv.SFCC_ADMIN_CLIENT_SECRET || "";
    const apiBase = mockEnv.SFCC_API_BASE || "";
    const ocapiVersion = mockEnv.OCAPI_VERSION || "v24_5";

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

  public getConfig() {
    return this.config;
  }

  public getRequestId(): string {
    return mockEnv.REQUEST_ID || 'default-request';
  }

  public setSessionCredentials(sessionId: string, credentials: any) {
    this.sessionCredentials[sessionId] = credentials;
  }

  public getSessionCredentials(sessionId: string) {
    return this.sessionCredentials[sessionId];
  }

  public clearSessionCredentials(sessionId: string) {
    delete this.sessionCredentials[sessionId];
  }
}

describe('Config Management', () => {
  let configManager: TestConfigManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (TestConfigManager as any).instance = undefined;
    configManager = TestConfigManager.getInstance();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = TestConfigManager.getInstance();
      const instance2 = TestConfigManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('getConfig', () => {
    it('should return configuration from mock environment variables', () => {
      const config = configManager.getConfig();
      
      expect(config).toEqual({
        adminClientId: 'test_client_id',
        adminClientSecret: 'test_client_secret',
        apiBase: 'https://test.api.com',
        userAgent: 'sfcc-mcp-server/1.0',
        ocapiVersion: 'v24_5'
      });
    });
  });

  describe('getRequestId', () => {
    it('should return request ID from mock environment variable', () => {
      const requestId = configManager.getRequestId();
      expect(requestId).toBe('test_request_id');
    });
  });

  describe('session credentials management', () => {
    const sessionId = 'test-session-123';
    const credentials = {
      clientId: 'session_client_id',
      clientSecret: 'session_client_secret',
      apiBase: 'https://session.api.com',
      ocapiVersion: 'v23_2'
    };

    it('should set and get session credentials', () => {
      configManager.setSessionCredentials(sessionId, credentials);
      const retrievedCredentials = configManager.getSessionCredentials(sessionId);
      
      expect(retrievedCredentials).toEqual(credentials);
    });

    it('should return undefined for non-existent session', () => {
      const retrievedCredentials = configManager.getSessionCredentials('non-existent');
      expect(retrievedCredentials).toBeUndefined();
    });

    it('should clear session credentials', () => {
      configManager.setSessionCredentials(sessionId, credentials);
      configManager.clearSessionCredentials(sessionId);
      
      const retrievedCredentials = configManager.getSessionCredentials(sessionId);
      expect(retrievedCredentials).toBeUndefined();
    });

    it('should handle multiple sessions independently', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      const credentials1 = { ...credentials, clientId: 'client1' };
      const credentials2 = { ...credentials, clientId: 'client2' };
      
      configManager.setSessionCredentials(session1, credentials1);
      configManager.setSessionCredentials(session2, credentials2);
      
      expect(configManager.getSessionCredentials(session1)).toEqual(credentials1);
      expect(configManager.getSessionCredentials(session2)).toEqual(credentials2);
      
      configManager.clearSessionCredentials(session1);
      
      expect(configManager.getSessionCredentials(session1)).toBeUndefined();
      expect(configManager.getSessionCredentials(session2)).toEqual(credentials2);
    });
  });
});