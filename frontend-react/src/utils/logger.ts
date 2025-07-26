/**
 * Logger service for environment-based logging in SyllabAI frontend.
 * 
 * This module provides structured logging with different behaviors for
 * development and production environments.
 */

interface LogData {
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: LogData;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDevelopment: boolean;
  private moduleName: string;
  private sensitiveKeys = ['password', 'token', 'secret', 'email', 'api_key', 'refresh_token'];

  constructor(moduleName: string) {
    this.isDevelopment = import.meta.env.DEV;
    this.moduleName = moduleName;
  }

  /**
   * Sanitize sensitive data from log entries
   */
  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Format log entry based on environment
   */
  private formatLogEntry(level: LogLevel, message: string, data?: LogData): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message: `[${this.moduleName}] ${message}`
    };

    if (data) {
      entry.data = this.sanitizeData(data);
    }

    return entry;
  }

  /**
   * Output log based on environment
   */
  private output(level: LogLevel, message: string, data?: LogData) {
    const entry = this.formatLogEntry(level, message, data);

    if (this.isDevelopment) {
      // In development, use appropriate console methods
      const consoleMethod = level === 'error' ? console.error : 
                          level === 'warn' ? console.warn : 
                          console.log;
      
      if (data) {
        consoleMethod(`${entry.timestamp} - ${entry.level} - ${entry.message}`, entry.data);
      } else {
        consoleMethod(`${entry.timestamp} - ${entry.level} - ${entry.message}`);
      }
    } else if (level === 'error' || level === 'warn') {
      // In production, only log warnings and errors
      const logData = {
        ...entry,
        userAgent: navigator.userAgent,
        url: window.location.href
      };
      
      // In a real production environment, you would send this to a logging service
      // For now, we'll use console.error but in a structured format
      console.error(JSON.stringify(logData));
      
      // TODO: Send to error monitoring service (e.g., Sentry, LogRocket)
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, data?: LogData) {
    if (this.isDevelopment) {
      this.output('debug', message, data);
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: LogData) {
    this.output('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: LogData) {
    this.output('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | unknown, data?: LogData) {
    const errorData: LogData = { ...data };
    
    if (error instanceof Error) {
      errorData.errorType = error.name;
      errorData.errorMessage = error.message;
      errorData.errorStack = this.isDevelopment ? error.stack : undefined;
    } else if (error) {
      errorData.error = String(error);
    }

    this.output('error', message, errorData);
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, data?: LogData) {
    this.debug(`Performance: ${operation}`, {
      ...data,
      durationMs: duration,
      durationSeconds: duration / 1000
    });
  }

  /**
   * Log user actions for analytics
   */
  analytics(event: string, properties?: LogData) {
    if (!this.isDevelopment) {
      // In production, send to analytics service
      // TODO: Integrate with analytics service (e.g., Google Analytics, Mixpanel)
    }
    
    this.debug(`Analytics: ${event}`, properties);
  }
}

/**
 * Factory function to create a logger instance
 */
export const createLogger = (moduleName: string): Logger => {
  return new Logger(moduleName);
};

/**
 * Performance measurement utility
 */
export const measurePerformance = async <T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    logger.performance(operation, duration, { status: 'success' });
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.performance(operation, duration, { status: 'error' });
    throw error;
  }
};

// Export a default logger for general use
export const logger = createLogger('SyllabAI');