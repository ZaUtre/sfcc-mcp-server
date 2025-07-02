import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger.js';

const REQUEST_ID = 'session-persistence';

interface SessionData {
  sessionCredentials: Record<string, { clientId: string; clientSecret: string; apiBase: string; ocapiVersion?: string }>;
  userCredentials: Record<string, { clientId: string; clientSecret: string; apiBase: string; sessionId: string; ocapiVersion?: string }>;
  authCodes: Record<string, string>;
  timestamp: number;
}

export class SessionPersistence {
  private static instance: SessionPersistence;
  private sessionFile: string;
  private sessionDir: string;

  private constructor() {
    // Use /tmp for App Engine compatibility
    this.sessionDir = process.env.SESSION_STORAGE_DIR || '/tmp/sfcc-sessions';
    this.sessionFile = join(this.sessionDir, 'sessions.json');
    
    // Ensure directory exists
    if (!existsSync(this.sessionDir)) {
      try {
        mkdirSync(this.sessionDir, { recursive: true });
      } catch (error) {
        Logger.warn(REQUEST_ID, `Failed to create session directory: ${(error as Error).message}`);
      }
    }
  }

  public static getInstance(): SessionPersistence {
    if (!SessionPersistence.instance) {
      SessionPersistence.instance = new SessionPersistence();
    }
    return SessionPersistence.instance;
  }

  public saveSessionData(data: Partial<SessionData>): void {
    try {
      const sessionData: SessionData = {
        sessionCredentials: {},
        userCredentials: {},
        authCodes: {},
        timestamp: Date.now(),
        ...data
      };

      writeFileSync(this.sessionFile, JSON.stringify(sessionData, null, 2));
      Logger.info(REQUEST_ID, 'Session data saved successfully');
    } catch (error) {
      Logger.warn(REQUEST_ID, `Failed to save session data: ${(error as Error).message}`);
    }
  }

  public loadSessionData(): SessionData | null {
    try {
      if (!existsSync(this.sessionFile)) {
        Logger.info(REQUEST_ID, 'No existing session file found');
        return null;
      }

      const data = readFileSync(this.sessionFile, 'utf8');
      const sessionData = JSON.parse(data) as SessionData;

      // Check if data is too old (older than 24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      if (Date.now() - sessionData.timestamp > maxAge) {
        Logger.info(REQUEST_ID, 'Session data is too old, ignoring');
        return null;
      }

      Logger.info(REQUEST_ID, 'Session data loaded successfully');
      return sessionData;
    } catch (error) {
      Logger.warn(REQUEST_ID, `Failed to load session data: ${(error as Error).message}`);
      return null;
    }
  }

  public clearSessionData(): void {
    try {
      if (existsSync(this.sessionFile)) {
        writeFileSync(this.sessionFile, JSON.stringify({
          sessionCredentials: {},
          userCredentials: {},
          authCodes: {},
          timestamp: Date.now()
        }, null, 2));
        Logger.info(REQUEST_ID, 'Session data cleared');
      }
    } catch (error) {
      Logger.warn(REQUEST_ID, `Failed to clear session data: ${(error as Error).message}`);
    }
  }
}

export const sessionPersistence = SessionPersistence.getInstance();