

export class Logger {
  public static log(requestId: string, message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${requestId}] ${message}`;
    console.log(logMessage);
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
