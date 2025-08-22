import {
  existsSync,
  mkdirSync,
  statSync,
  appendFileSync,
  unlinkSync,
  renameSync,
} from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));


class Logger {
  constructor(options = {}) {
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info';
    this.logToFile = options.logToFile !== false; // Default to true
    this.logToConsole = options.logToConsole !== false; // Default to true
    this.logDir = options.logDir || join(__dirname, '../logs');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = options.maxLogFiles || 5;

    // Ensure log directory exists
    if (this.logToFile) {
      this.ensureLogDirectory();
    }

    // Log levels with numeric values for comparison
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    this.currentLogLevel = this.levels[this.logLevel] || this.levels.info;
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error.message);
      this.logToFile = false; // Disable file logging if directory creation fails
    }
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {string} - Formatted log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta,
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Write log to file
   * @param {string} level - Log level
   * @param {string} formattedMessage - Formatted log message
   */
  writeToFile(level, formattedMessage) {
    if (!this.logToFile) return;

    try {
      const logFile = join(this.logDir, `${level}.log`);

      // Check file size and rotate if necessary
      if (existsSync(logFile)) {
        const stats = statSync(logFile);
        if (stats.size > this.maxLogSize) {
          this.rotateLogFile(logFile);
        }
      }

      appendFileSync(logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  /**
   * Rotate log file when it gets too large
   * @param {string} logFile - Path to log file
   */
  rotateLogFile(logFile) {
    try {
      const ext = extname(logFile);
      const baseName = basename(logFile, ext);
      const dir = dirname(logFile);

      // Shift existing rotated files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = join(dir, `${baseName}.${i}${ext}`);
        const newFile = join(dir, `${baseName}.${i + 1}${ext}`);

        if (existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            unlinkSync(oldFile); // Delete oldest file
          } else {
            renameSync(oldFile, newFile);
          }
        }
      }

      // Move current file to .1
      const rotatedFile = join(dir, `${baseName}.1${ext}`);
      renameSync(logFile, rotatedFile);
    } catch (error) {
      console.error('Failed to rotate log file:', error.message);
    }
  }

  /**
   * Log a message at the specified level
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    const levelValue = this.levels[level];
    if (levelValue === undefined || levelValue > this.currentLogLevel) {
      return; // Skip logging if level is not enabled
    }

    const formattedMessage = `${'='.repeat(20)}\n[QR SERVER] ${level.toUpperCase()}\n${this.formatMessage(level, message, meta)}\n${'='.repeat(20)}\n`;

    if (this.logToConsole) {
      const consoleMethod =
        level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](formattedMessage);
    }

    if (this.logToFile) {
      this.writeToFile(level, formattedMessage);
    }
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  /**
   * Log check-in attempt
   * @param {Object} checkInData - Check-in data
   */
  logCheckInAttempt(checkInData) {
    const { phoneNumber, otp, validationStatus, timestamp, checkinId, error } =
      checkInData;

    const meta = {
      type: 'checkin_attempt',
      phoneNumber: this.maskPhoneNumber(phoneNumber),
      otp: otp ? otp.substring(0, 2) + '****' : null, // Mask OTP for security
      validationStatus,
      timestamp,
      checkinId,
      ...(error && { error: error.message }),
    };

    if (validationStatus === 'valid') {
      this.info('Check-in successful', meta);
    } else if (error) {
      this.error('Check-in failed with error', meta);
    } else {
      this.warn('Check-in failed validation', meta);
    }
  }

  /**
   * Log system error
   * @param {string} component - Component where error occurred
   * @param {Error} error - Error object
   * @param {Object} context - Additional context
   */
  logSystemError(component, error, context = {}) {
    const meta = {
      type: 'system_error',
      component,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...context,
    };

    this.error(`System error in ${component}`, meta);
  }

  /**
   * Log database operation
   * @param {string} operation - Database operation
   * @param {Object} details - Operation details
   */
  logDatabaseOperation(operation, details = {}) {
    const meta = {
      type: 'database_operation',
      operation,
      ...details,
    };

    if (details.error) {
      this.error(`Database operation failed: ${operation}`, meta);
    } else {
      this.debug(`Database operation: ${operation}`, meta);
    }
  }

  /**
   * Mask phone number for privacy
   * @param {string} phoneNumber - Phone number to mask
   * @returns {string} - Masked phone number
   */
  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 4) {
      return '****';
    }

    const visible = phoneNumber.slice(-4);
    const masked = '*'.repeat(phoneNumber.length - 4);
    return masked + visible;
  }

  /**
   * Get logger statistics
   * @returns {Object} - Logger statistics
   */
  getStats() {
    return {
      logLevel: this.logLevel,
      currentLogLevel: this.currentLogLevel,
      logToFile: this.logToFile,
      logToConsole: this.logToConsole,
      logDir: this.logDir,
      maxLogSize: this.maxLogSize,
      maxLogFiles: this.maxLogFiles,
    };
  }
}

// Create singleton logger instance
const logger = new Logger();

// Bind methods to maintain context when destructured
const boundLogger = {
  log: logger.log.bind(logger),
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  debug: logger.debug.bind(logger),
  logCheckInAttempt: logger.logCheckInAttempt.bind(logger),
  logSystemError: logger.logSystemError.bind(logger),
  logDatabaseOperation: logger.logDatabaseOperation.bind(logger),
  formatMessage: logger.formatMessage.bind(logger),
  writeToFile: logger.writeToFile.bind(logger),
  rotateLogFile: logger.rotateLogFile.bind(logger),
  maskPhoneNumber: logger.maskPhoneNumber.bind(logger),
  getStats: logger.getStats.bind(logger),
};

export default boundLogger;
