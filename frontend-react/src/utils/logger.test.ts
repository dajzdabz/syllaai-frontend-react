/**
 * Unit tests for the SyllabAI frontend logger service.
 */

import { createLogger, measurePerformance, logger } from './logger';

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock performance.now()
const mockPerformanceNow = jest.spyOn(performance, 'now');

describe('Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset import.meta.env
    Object.defineProperty(import.meta, 'env', {
      value: {
        DEV: true,
        PROD: false,
        MODE: 'test'
      },
      configurable: true
    });
  });

  describe('createLogger', () => {
    it('should create a logger instance with the given module name', () => {
      const testLogger = createLogger('TestModule');
      testLogger.info('Test message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[TestModule]'),
        undefined
      );
    });
  });

  describe('Logger in development mode', () => {
    it('should log debug messages in development', () => {
      const testLogger = createLogger('Test');
      testLogger.debug('Debug message', { key: 'value' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG'),
        expect.objectContaining({ key: 'value' })
      );
    });

    it('should log info messages in development', () => {
      const testLogger = createLogger('Test');
      testLogger.info('Info message');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('INFO'),
        undefined
      );
    });

    it('should log warnings with console.warn', () => {
      const testLogger = createLogger('Test');
      testLogger.warn('Warning message');

      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('WARN'),
        undefined
      );
    });

    it('should log errors with console.error', () => {
      const testLogger = createLogger('Test');
      const error = new Error('Test error');
      testLogger.error('Error occurred', error);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        expect.objectContaining({
          errorType: 'Error',
          errorMessage: 'Test error'
        })
      );
    });
  });

  describe('Logger in production mode', () => {
    beforeEach(() => {
      Object.defineProperty(import.meta, 'env', {
        value: {
          DEV: false,
          PROD: true,
          MODE: 'production'
        },
        configurable: true
      });
    });

    it('should not log debug messages in production', () => {
      const testLogger = createLogger('Test');
      testLogger.debug('Debug message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should not log info messages in production', () => {
      const testLogger = createLogger('Test');
      testLogger.info('Info message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should log warnings in production', () => {
      const testLogger = createLogger('Test');
      testLogger.warn('Warning message');

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('"level":"WARN"')
      );
    });

    it('should log errors in production with structured format', () => {
      const testLogger = createLogger('Test');
      testLogger.error('Error message');

      const logCall = mockConsoleError.mock.calls[0][0];
      const logData = JSON.parse(logCall);
      
      expect(logData).toMatchObject({
        level: 'ERROR',
        message: expect.stringContaining('Error message'),
        userAgent: expect.any(String),
        url: expect.any(String)
      });
    });
  });

  describe('Data sanitization', () => {
    it('should sanitize sensitive data fields', () => {
      const testLogger = createLogger('Test');
      const sensitiveData = {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com',
        api_key: 'key123',
        token: 'token456',
        refresh_token: 'refresh789',
        normalField: 'visible'
      };

      testLogger.debug('Logging sensitive data', sensitiveData);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          username: 'john',
          password: '[REDACTED]',
          email: '[REDACTED]',
          api_key: '[REDACTED]',
          token: '[REDACTED]',
          refresh_token: '[REDACTED]',
          normalField: 'visible'
        })
      );
    });

    it('should sanitize nested sensitive data', () => {
      const testLogger = createLogger('Test');
      const nestedData = {
        user: {
          name: 'John',
          credentials: {
            password: 'secret',
            apiToken: 'token123'
          }
        }
      };

      testLogger.debug('Nested data', nestedData);

      const loggedData = mockConsoleLog.mock.calls[0][1];
      expect(loggedData.user.credentials.password).toBe('[REDACTED]');
      expect(loggedData.user.credentials.apiToken).toBe('[REDACTED]');
      expect(loggedData.user.name).toBe('John');
    });

    it('should handle arrays in data sanitization', () => {
      const testLogger = createLogger('Test');
      const arrayData = {
        users: [
          { name: 'User1', password: 'pass1' },
          { name: 'User2', email: 'user2@example.com' }
        ]
      };

      testLogger.debug('Array data', arrayData);

      const loggedData = mockConsoleLog.mock.calls[0][1];
      expect(loggedData.users[0].password).toBe('[REDACTED]');
      expect(loggedData.users[1].email).toBe('[REDACTED]');
    });
  });

  describe('Performance logging', () => {
    it('should log performance metrics', () => {
      const testLogger = createLogger('Test');
      testLogger.performance('API call', 150.5, { endpoint: '/api/test' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Performance: API call'),
        expect.objectContaining({
          durationMs: 150.5,
          durationSeconds: 0.1505,
          endpoint: '/api/test'
        })
      );
    });
  });

  describe('Analytics logging', () => {
    it('should log analytics events in development', () => {
      const testLogger = createLogger('Test');
      testLogger.analytics('button_click', { button: 'submit' });

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Analytics: button_click'),
        expect.objectContaining({ button: 'submit' })
      );
    });

    it('should not log analytics to console in production', () => {
      Object.defineProperty(import.meta, 'env', {
        value: { DEV: false, PROD: true },
        configurable: true
      });

      const testLogger = createLogger('Test');
      testLogger.analytics('page_view', { page: '/home' });

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('measurePerformance utility', () => {
    it('should measure successful async operation performance', async () => {
      const testLogger = createLogger('Test');
      mockPerformanceNow
        .mockReturnValueOnce(1000)  // Start time
        .mockReturnValueOnce(1250); // End time

      const result = await measurePerformance(
        testLogger,
        'async operation',
        async () => 'success'
      );

      expect(result).toBe('success');
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Performance: async operation'),
        expect.objectContaining({
          durationMs: 250,
          status: 'success'
        })
      );
    });

    it('should measure failed async operation performance', async () => {
      const testLogger = createLogger('Test');
      mockPerformanceNow
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1100);

      const asyncFn = async () => {
        throw new Error('Operation failed');
      };

      await expect(
        measurePerformance(testLogger, 'failed operation', asyncFn)
      ).rejects.toThrow('Operation failed');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Performance: failed operation'),
        expect.objectContaining({
          durationMs: 100,
          status: 'error'
        })
      );
    });
  });

  describe('Default logger export', () => {
    it('should provide a default logger instance', () => {
      expect(logger).toBeDefined();
      logger.info('Default logger test');

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[SyllabAI]'),
        undefined
      );
    });
  });
});