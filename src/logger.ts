import fs from 'fs';
import path from 'path';

export class Logger {
  private static getLogFilePath(requestId: string): string {
    return path.join(__dirname, `${requestId}.log`);
  }

  public static log(requestId: string, message: string): void {
    const logFilePath = this.getLogFilePath(requestId);
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(logFilePath, logMessage, 'utf8');
    } catch (error) {
      console.error(`Failed to write to log file: ${error}`);
    }
  }

  public static error(requestId: string, message: string, error?: Error): void {
    const errorMessage = error ? `${message}: ${error.message}` : message;
    this.log(requestId, `ERROR - ${errorMessage}`);
  }

  public static info(requestId: string, message: string): void {
    this.log(requestId, `INFO - ${message}`);
  }

  public static warn(requestId: string, message: string): void {
    this.log(requestId, `WARN - ${message}`);
  }
}
