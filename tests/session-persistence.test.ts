import { SessionPersistence } from '../src/session-persistence.js';
import { ConfigManager } from '../src/config.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

// Test environment setup
const mockEnv = {
  SFCC_ADMIN_CLIENT_ID: 'test_client_id',
  SFCC_ADMIN_CLIENT_SECRET: 'test_client_secret',
  SFCC_API_BASE: 'https://test.api.com',
  OCAPI_VERSION: 'v24_5',
  REQUEST_ID: 'test_request_id',
  SESSION_STORAGE_DIR: '/tmp/test-sessions-' + Date.now()
};

describe('Session Persistence', () => {
  let sessionPersistence: SessionPersistence;
  let configManager: ConfigManager;
  const testSessionFile = join(mockEnv.SESSION_STORAGE_DIR, 'sessions.json');

  beforeAll(() => {
    // Set up test environment
    Object.keys(mockEnv).forEach(key => {
      process.env[key] = mockEnv[key as keyof typeof mockEnv];
    });
  });

  beforeEach(() => {
    // Reset SessionPersistence instance to use new test directory
    (SessionPersistence as any).instance = null;
    
    // Clean up any existing test session file
    if (existsSync(testSessionFile)) {
      unlinkSync(testSessionFile);
    }
    
    sessionPersistence = SessionPersistence.getInstance();
    configManager = ConfigManager.getInstance();
  });

  afterEach(() => {
    // Clean up test session file
    if (existsSync(testSessionFile)) {
      unlinkSync(testSessionFile);
    }
  });

  afterAll(() => {
    // Clean up environment
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  describe('SessionPersistence', () => {
    it('should return null for non-existent session file', () => {
      // Ensure no session file exists
      if (existsSync(testSessionFile)) {
        unlinkSync(testSessionFile);
      }
      
      const loadedData = sessionPersistence.loadSessionData();
      expect(loadedData).toBeNull();
    });

    it('should save and load session data', () => {
      const testData = {
        sessionCredentials: {
          'session-1': {
            clientId: 'client1',
            clientSecret: 'secret1',
            apiBase: 'https://api1.com',
            ocapiVersion: 'v24_5'
          }
        },
        userCredentials: {
          'user-1': {
            clientId: 'client1',
            clientSecret: 'secret1',
            apiBase: 'https://api1.com',
            sessionId: 'session-1',
            ocapiVersion: 'v24_5'
          }
        },
        authCodes: {
          'auth-code-123': 'session-1'
        },
        timestamp: Date.now()
      };

      sessionPersistence.saveSessionData(testData);
      const loadedData = sessionPersistence.loadSessionData();

      expect(loadedData).toBeTruthy();
      expect(loadedData!.sessionCredentials).toEqual(testData.sessionCredentials);
      expect(loadedData!.userCredentials).toEqual(testData.userCredentials);
      expect(loadedData!.authCodes).toEqual(testData.authCodes);
    });

    it('should return empty data for cleared session file', () => {
      // First save some data
      sessionPersistence.saveSessionData({
        sessionCredentials: { 'test': { clientId: 'test', clientSecret: 'test', apiBase: 'test' } },
        userCredentials: {},
        authCodes: {},
        timestamp: Date.now()
      });
      
      // Then clear it
      sessionPersistence.clearSessionData();
      
      const loadedData = sessionPersistence.loadSessionData();
      expect(loadedData).toBeTruthy();
      expect(loadedData!.sessionCredentials).toEqual({});
      expect(loadedData!.userCredentials).toEqual({});
      expect(loadedData!.authCodes).toEqual({});
    });

    it('should ignore old session data', () => {
      const oldData = {
        sessionCredentials: { 'old-session': { clientId: 'old', clientSecret: 'old', apiBase: 'old' } },
        userCredentials: {},
        authCodes: {},
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      };

      sessionPersistence.saveSessionData(oldData);
      const loadedData = sessionPersistence.loadSessionData();

      expect(loadedData).toBeNull();
    });

    it('should clear session data', () => {
      const testData = {
        sessionCredentials: { 'session-1': { clientId: 'client1', clientSecret: 'secret1', apiBase: 'api1' } },
        userCredentials: {},
        authCodes: {},
        timestamp: Date.now()
      };

      sessionPersistence.saveSessionData(testData);
      sessionPersistence.clearSessionData();
      
      const loadedData = sessionPersistence.loadSessionData();
      expect(loadedData).toBeTruthy();
      expect(loadedData!.sessionCredentials).toEqual({});
      expect(loadedData!.userCredentials).toEqual({});
      expect(loadedData!.authCodes).toEqual({});
    });
  });

  describe('ConfigManager persistence integration', () => {
    it('should persist session credentials when set', () => {
      const sessionId = 'test-session-persist';
      const credentials = {
        clientId: 'persist_client_id',
        clientSecret: 'persist_client_secret',
        apiBase: 'https://persist.api.com',
        ocapiVersion: 'v24_5'
      };

      // Set credentials (should trigger persistence)
      configManager.setSessionCredentials(sessionId, credentials);

      // Verify it was saved by checking if we can retrieve it
      const retrievedCredentials = configManager.getSessionCredentials(sessionId);
      expect(retrievedCredentials).toEqual(credentials);
    });

    it('should restore session credentials on startup', () => {
      const sessionId = 'test-session-restore';
      const credentials = {
        clientId: 'restore_client_id',
        clientSecret: 'restore_client_secret',
        apiBase: 'https://restore.api.com',
        ocapiVersion: 'v24_5'
      };

      // Save data directly to persistence layer first
      sessionPersistence.saveSessionData({
        sessionCredentials: { [sessionId]: credentials },
        userCredentials: {},
        authCodes: {},
        timestamp: Date.now()
      });

      // Clear existing ConfigManager instance data to simulate restart
      const configManager = ConfigManager.getInstance();
      (configManager as any).sessionCredentials = {};
      
      // Call restore method to simulate what happens in constructor
      (configManager as any).restoreSessionCredentials();
      
      // Should have restored the credentials
      const retrievedCredentials = configManager.getSessionCredentials(sessionId);
      expect(retrievedCredentials).toEqual(credentials);
    });

    it('should remove session credentials when cleared', () => {
      const sessionId = 'test-session-clear';
      const credentials = {
        clientId: 'clear_client_id',
        clientSecret: 'clear_client_secret',
        apiBase: 'https://clear.api.com'
      };

      // Set and then clear credentials
      configManager.setSessionCredentials(sessionId, credentials);
      expect(configManager.getSessionCredentials(sessionId)).toEqual(credentials);
      
      configManager.clearSessionCredentials(sessionId);
      expect(configManager.getSessionCredentials(sessionId)).toBeUndefined();
    });
  });
});