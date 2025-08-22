import logger from './logger.js';

/**
 * Standard error codes used throughout the application
 */
const ERROR_CODES = {
  // Validation errors (400)
  INVALID_OTP_FORMAT: 'INVALID_OTP_FORMAT',
  INVALID_PHONE_FORMAT: 'INVALID_PHONE_FORMAT',
  INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
  INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INVALID_LIMIT: 'INVALID_LIMIT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Authentication/Authorization errors (401/403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',

  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',

  // OTP specific errors (410)
  OTP_EXPIRED: 'OTP_EXPIRED',
  EXPIRED_OR_INVALID: 'EXPIRED_OR_INVALID',
  FUTURE_OTP: 'FUTURE_OTP',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  CHECKIN_RATE_LIMIT: 'CHECKIN_RATE_LIMIT',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  OTP_GENERATION_FAILED: 'OTP_GENERATION_FAILED',
  QR_GENERATION_FAILED: 'QR_GENERATION_FAILED',
  URL_GENERATION_FAILED: 'URL_GENERATION_FAILED',

  // Database specific errors
  DATABASE_CONNECTION_FAILED: 'DATABASE_CONNECTION_FAILED',
  DATABASE_QUERY_FAILED: 'DATABASE_QUERY_FAILED',
  DATABASE_TIMEOUT: 'DATABASE_TIMEOUT',

  // Service specific errors
  OTP_SERVICE_ERROR: 'OTP_SERVICE_ERROR',
  WHATSAPP_SERVICE_ERROR: 'WHATSAPP_SERVICE_ERROR',
  CONFIG_SERVICE_ERROR: 'CONFIG_SERVICE_ERROR',
};

/**
 * Application error class with structured error information
 */
class AppError extends Error {
  constructor(code, message, statusCode = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, AppError);
  }

  /**
   * Convert error to JSON response format
   * @param {boolean} includeStack - Whether to include stack trace
   * @returns {Object} - Error response object
   */
  toJSON(includeStack = false) {
    const errorResponse = {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp,
        ...this.details,
      },
    };

    if (includeStack && process.env.NODE_ENV !== 'production') {
      errorResponse.error.stack = this.stack;
    }

    return errorResponse;
  }
}

/**
 * Database error handler
 */
class DatabaseErrorHandler {
  /**
   * Handle database connection errors
   * @param {Error} error - Database error
   * @param {string} operation - Operation that failed
   * @returns {AppError} - Structured application error
   */
  static handleConnectionError(error, operation = 'database operation') {
    logger.logSystemError('database', error, {
      operation,
      type: 'connection_error',
    });

    if (error.code === 'SQLITE_CANTOPEN') {
      return new AppError(
        ERROR_CODES.DATABASE_CONNECTION_FAILED,
        'Database file cannot be opened',
        503,
        { operation, originalError: error.message },
      );
    }

    if (error.code === 'SQLITE_BUSY') {
      return new AppError(
        ERROR_CODES.DATABASE_TIMEOUT,
        'Database is busy, please try again',
        503,
        { operation, originalError: error.message },
      );
    }

    return new AppError(
      ERROR_CODES.DATABASE_CONNECTION_FAILED,
      'Failed to connect to database',
      503,
      { operation, originalError: error.message },
    );
  }

  /**
   * Handle database query errors
   * @param {Error} error - Database error
   * @param {string} query - SQL query that failed
   * @param {Array} params - Query parameters
   * @returns {AppError} - Structured application error
   */
  static handleQueryError(error, query = '', params = []) {
    logger.logSystemError('database', error, {
      type: 'query_error',
      query: query.substring(0, 100), // Truncate long queries
      paramCount: params.length,
    });

    if (error.code === 'SQLITE_CONSTRAINT') {
      return new AppError(
        ERROR_CODES.DATABASE_ERROR,
        'Database constraint violation',
        400,
        { originalError: error.message },
      );
    }

    if (error.code === 'SQLITE_READONLY') {
      return new AppError(
        ERROR_CODES.DATABASE_ERROR,
        'Database is read-only',
        503,
        { originalError: error.message },
      );
    }

    return new AppError(
      ERROR_CODES.DATABASE_QUERY_FAILED,
      'Database query failed',
      500,
      { originalError: error.message },
    );
  }
}

/**
 * Service error handler
 */
class ServiceErrorHandler {
  /**
   * Handle OTP service errors
   * @param {Error} error - OTP service error
   * @param {string} operation - Operation that failed
   * @returns {AppError} - Structured application error
   */
  static handleOTPServiceError(error, operation = 'OTP operation') {
    logger.logSystemError('otp_service', error, { operation });

    return new AppError(
      ERROR_CODES.OTP_SERVICE_ERROR,
      'OTP service error',
      500,
      { operation, originalError: error.message },
    );
  }

  /**
   * Handle WhatsApp service errors
   * @param {Error} error - WhatsApp service error
   * @param {string} operation - Operation that failed
   * @returns {AppError} - Structured application error
   */
  static handleWhatsAppServiceError(error, operation = 'WhatsApp operation') {
    logger.logSystemError('whatsapp_service', error, { operation });

    return new AppError(
      ERROR_CODES.WHATSAPP_SERVICE_ERROR,
      'WhatsApp service error',
      500,
      { operation, originalError: error.message },
    );
  }

  /**
   * Handle configuration service errors
   * @param {Error} error - Config service error
   * @param {string} operation - Operation that failed
   * @returns {AppError} - Structured application error
   */
  static handleConfigServiceError(error, operation = 'Config operation') {
    logger.logSystemError('config_service', error, { operation });

    return new AppError(
      ERROR_CODES.CONFIG_SERVICE_ERROR,
      'Configuration service error',
      500,
      { operation, originalError: error.message },
    );
  }
}

/**
 * Validation error handler
 */
class ValidationErrorHandler {
  /**
   * Create phone number validation error
   * @param {string} phoneNumber - Invalid phone number
   * @returns {AppError} - Validation error
   */
  static invalidPhoneNumber(phoneNumber) {
    return new AppError(
      ERROR_CODES.INVALID_PHONE_FORMAT,
      'Phone number must be in valid international format',
      400,
      {
        providedValue: phoneNumber ? phoneNumber.substring(0, 5) + '***' : null,
      },
    );
  }

  /**
   * Create OTP validation error
   * @param {string} otp - Invalid OTP
   * @returns {AppError} - Validation error
   */
  static invalidOTP(otp) {
    return new AppError(
      ERROR_CODES.INVALID_OTP_FORMAT,
      'OTP must be a 6-character alphanumeric string',
      400,
      { providedValue: otp ? otp.substring(0, 2) + '****' : null },
    );
  }

  /**
   * Create timestamp validation error
   * @param {string} timestamp - Invalid timestamp
   * @returns {AppError} - Validation error
   */
  static invalidTimestamp(timestamp) {
    return new AppError(
      ERROR_CODES.INVALID_TIMESTAMP,
      'Timestamp is too far from current time',
      400,
      { providedValue: timestamp },
    );
  }

  /**
   * Create missing field validation error
   * @param {string} fieldName - Name of missing field
   * @returns {AppError} - Validation error
   */
  static missingRequiredField(fieldName) {
    return new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      `Required field '${fieldName}' is missing`,
      400,
      { fieldName },
    );
  }
}

/**
 * Express error handling middleware
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorMiddleware(error, req, res) {
  // Log the error
  logger.logSystemError('express_middleware', error, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Handle AppError instances
  if (error instanceof AppError) {
    return res
      .status(error.statusCode)
      .json(error.toJSON(process.env.NODE_ENV !== 'production'));
  }

  // Handle specific error types
  if (error.name === 'ValidationError') {
    const appError = new AppError(
      ERROR_CODES.INVALID_OTP_FORMAT,
      error.message,
      400,
    );
    return res.status(400).json(appError.toJSON());
  }

  if (error.code && error.code.startsWith('SQLITE_')) {
    const dbError = DatabaseErrorHandler.handleQueryError(error);
    return res.status(dbError.statusCode).json(dbError.toJSON());
  }

  // Handle unexpected errors
  const unexpectedError = new AppError(
    ERROR_CODES.INTERNAL_ERROR,
    'An unexpected error occurred',
    500,
    {
      originalError:
        process.env.NODE_ENV !== 'production' ? error.message : undefined,
    },
  );

  res
    .status(500)
    .json(unexpectedError.toJSON(process.env.NODE_ENV !== 'production'));
}

/**
 * Async handler wrapper to catch async errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create graceful degradation response
 * @param {string} service - Service that failed
 * @param {string} fallbackMessage - Fallback message
 * @returns {Object} - Degraded response
 */
function createDegradedResponse(
  service,
  fallbackMessage = 'Service temporarily unavailable',
) {
  logger.warn(`Service degradation: ${service}`, {
    type: 'service_degradation',
    service,
  });

  return {
    success: false,
    degraded: true,
    error: {
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: fallbackMessage,
      service,
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  ERROR_CODES,
  AppError,
  DatabaseErrorHandler,
  ServiceErrorHandler,
  ValidationErrorHandler,
  errorMiddleware,
  asyncHandler,
  createDegradedResponse,
};
