// Custom logger for the Redash MCP server

/**
 * Log levels supported by MCP
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  NOTICE = "notice",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
  ALERT = "alert",
  EMERGENCY = "emergency"
}

/**
 * Logger class that outputs to both console and can send notifications to clients
 */
export class Logger {
  private server: any | null = null;

  /**
   * Sets the MCP server instance to enable sending log notifications
   */
  setServer(server: any): void {
    this.server = server;
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  /**
   * Log a warning message
   */
  warning(message: string): void {
    this.log(LogLevel.WARNING, message);
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  /**
   * Log a message with the specified level
   */
  log(level: LogLevel, message: string): void {
    // Always output to stderr for local debugging
    console.error(`[${level.toUpperCase()}] ${message}`);

    // If server is set and supports logging notifications, send them
    if (this.server && typeof this.server.notification === 'function') {
      try {
        this.server.notification({
          method: "notifications/logging",
          params: {
            level: level,
            data: message
          }
        });
      } catch (err) {
        // If notification fails, just log to console
        console.error(`Failed to send log notification: ${err}`);
      }
    }
  }
}

// Export a singleton instance
export const logger = new Logger();
