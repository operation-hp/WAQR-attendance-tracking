import { createHmac } from 'crypto';

import errorHandler from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

import { envConfig } from '#src/configs/environment.js';

const { ServiceErrorHandler } = errorHandler;

class OTPService {
  constructor(
    secretKey = envConfig.QR_CODE_SERVER.OTP_SECRET || 'default-secret-key',
  ) {
    if (!secretKey || secretKey.length < 16) {
      logger.warn(
        'OTP secret key is too short, using default (not secure for production)',
      );
    }

    this.secretKey = secretKey;
    this.timeWindow = this._validateTimeWindow(
      envConfig.QR_CODE_SERVER.DEFAULT_TIME_WINDOW_MS,
    );
    this.generationCount = 0;
    this.validationCount = 0;
    this.lastGenerationTime = null;

    logger.info('OTP Service initialized', {
      timeWindow: this.timeWindow,
      secretKeyLength: this.secretKey.length,
    });
  }

  _validateTimeWindow(timeWindow) {
    if (
      typeof timeWindow !== 'number' ||
      timeWindow < 30000 ||
      timeWindow > 300000
    ) {
      throw new Error(
        'Time window must be a number between 30 seconds and 5 minutes',
      );
    }
    return timeWindow;
  }

  /**
   * Generate OTP for a specific timestamp with error handling
   * @param {number} timestamp - Unix timestamp in milliseconds
   * @returns {string} - 6-character alphanumeric OTP
   */
  generateOTP(timestamp = Date.now()) {
    try {
      if (typeof timestamp !== 'number' || timestamp <= 0) {
        throw new Error('Invalid timestamp provided');
      }

      // Round timestamp to 30-second intervals
      const timeSlot = Math.floor(timestamp / this.timeWindow);

      // Create hash using timeSlot + secretKey
      const hash = createHmac('sha256', this.secretKey)
        .update(timeSlot.toString())
        .digest('hex');

      // Extract 6-character alphanumeric code from hash
      // Use first 6 characters and convert to uppercase for readability
      const otp = hash.substring(0, 6).toUpperCase();

      this.generationCount++;
      this.lastGenerationTime = timestamp;

      logger.debug('OTP generated', {
        timeSlot,
        timestamp: new Date(timestamp).toISOString(),
        generationCount: this.generationCount,
      });

      return otp;
    } catch (error) {
      logger.logSystemError('otp_generation', error, { timestamp });
      throw ServiceErrorHandler.handleOTPServiceError(error, 'OTP generation');
    }
  }

  /**
   * Get current valid OTP with expiry information and error handling
   * @returns {Object} - Current OTP with timing information
   */
  getCurrentOTP() {
    try {
      const now = Date.now();
      const currentOTP = this.generateOTP(now);

      // Calculate when current OTP expires
      const currentTimeSlot = Math.floor(now / this.timeWindow);
      const expiresAt = (currentTimeSlot + 1) * this.timeWindow;
      const expiresIn = Math.ceil((expiresAt - now) / 1000); // seconds until expiry

      // Generate next OTP for preloading
      const nextOTP = this.generateOTP(expiresAt);

      const result = {
        otp: currentOTP,
        expiresIn: expiresIn,
        expiresAt: new Date(expiresAt).toISOString(),
        nextOtp: nextOTP,
        generatedAt: new Date(now).toISOString(),
      };

      logger.debug('Current OTP retrieved', {
        expiresIn,
        timeSlot: currentTimeSlot,
      });

      return result;
    } catch (error) {
      logger.logSystemError('current_otp_retrieval', error);
      throw ServiceErrorHandler.handleOTPServiceError(
        error,
        'current OTP retrieval',
      );
    }
  }

  /**
   * Validate an OTP against current and previous time windows with comprehensive error handling
   * @param {string} otp - OTP to validate
   * @param {number} timestamp - Timestamp when OTP was received (optional)
   * @returns {Object} - Validation result with details
   */
  validateOTP(otp, timestamp = Date.now()) {
    try {
      this.validationCount++;

      if (!otp || typeof otp !== 'string') {
        logger.debug('OTP validation failed - invalid format', {
          otp: otp ? 'provided' : 'missing',
          type: typeof otp,
          validationCount: this.validationCount,
        });

        return {
          valid: false,
          reason: 'INVALID_FORMAT',
          message: 'OTP must be a non-empty string',
        };
      }

      if (typeof timestamp !== 'number' || timestamp <= 0) {
        logger.warn('Invalid timestamp provided for OTP validation', {
          timestamp,
        });
        timestamp = Date.now();
      }

      // Normalize OTP (uppercase, trim)
      const normalizedOTP = otp.trim().toUpperCase();

      if (normalizedOTP.length !== 6) {
        logger.debug('OTP validation failed - incorrect length', {
          length: normalizedOTP.length,
          validationCount: this.validationCount,
        });

        return {
          valid: false,
          reason: 'INVALID_FORMAT',
          message: 'OTP must be exactly 6 characters',
        };
      }

      // Check current time window
      const currentOTP = this.generateOTP(timestamp);
      if (normalizedOTP === currentOTP) {
        logger.info('OTP validation successful - current window', {
          timeWindow: 'current',
          validationCount: this.validationCount,
        });

        return {
          valid: true,
          reason: 'CURRENT_WINDOW',
          message: 'OTP is valid (current window)',
          timeWindow: 'current',
        };
      }

      // Check previous time window (30 seconds ago)
      const previousTimestamp = timestamp - this.timeWindow;
      const previousOTP = this.generateOTP(previousTimestamp);
      if (normalizedOTP === previousOTP) {
        logger.info('OTP validation successful - previous window', {
          timeWindow: 'previous',
          validationCount: this.validationCount,
        });

        return {
          valid: true,
          reason: 'PREVIOUS_WINDOW',
          message: 'OTP is valid (previous window)',
          timeWindow: 'previous',
        };
      }

      // Check if OTP might be from future (clock drift protection)
      const futureTimestamp = timestamp + this.timeWindow;
      const futureOTP = this.generateOTP(futureTimestamp);
      if (normalizedOTP === futureOTP) {
        logger.warn('OTP validation failed - future OTP detected', {
          validationCount: this.validationCount,
          clockDrift: 'possible',
        });

        return {
          valid: false,
          reason: 'FUTURE_OTP',
          message: 'OTP is from future time window',
        };
      }

      logger.debug('OTP validation failed - expired or invalid', {
        validationCount: this.validationCount,
      });

      return {
        valid: false,
        reason: 'EXPIRED_OR_INVALID',
        message: 'OTP is expired or invalid',
      };
    } catch (error) {
      logger.logSystemError('otp_validation', error, {
        otp: otp ? otp.substring(0, 2) + '****' : null,
        timestamp,
      });

      return {
        valid: false,
        reason: 'VALIDATION_ERROR',
        message: 'OTP validation failed due to system error',
      };
    }
  }

  /**
   * Get time until next OTP rotation
   * @param {number} timestamp - Current timestamp (optional)
   * @returns {number} - Seconds until next rotation
   */
  getTimeUntilNext(timestamp = Date.now()) {
    const currentTimeSlot = Math.floor(timestamp / this.timeWindow);
    const nextRotation = (currentTimeSlot + 1) * this.timeWindow;
    return Math.ceil((nextRotation - timestamp) / 1000);
  }

  /**
   * Get OTP generation statistics for monitoring
   * @returns {Object} - Service statistics
   */
  getStats() {
    try {
      const now = Date.now();
      const currentTimeSlot = Math.floor(now / this.timeWindow);

      return {
        timeWindow: this.timeWindow,
        currentTimeSlot: currentTimeSlot,
        timeUntilNext: this.getTimeUntilNext(now),
        secretKeyLength: this.secretKey.length,
        generationCount: this.generationCount,
        validationCount: this.validationCount,
        lastGenerationTime: this.lastGenerationTime
          ? new Date(this.lastGenerationTime).toISOString()
          : null,
        timestamp: new Date(now).toISOString(),
        uptime: process.uptime(),
      };
    } catch (error) {
      logger.logSystemError('otp_stats', error);
      return {
        error: 'Failed to retrieve OTP service statistics',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get service health status
   * @returns {Object} - Health status
   */
  getHealthStatus() {
    try {
      const testOTP = this.generateOTP();
      const validation = this.validateOTP(testOTP);

      return {
        status: validation.valid ? 'healthy' : 'unhealthy',
        testGeneration: !!testOTP,
        testValidation: validation.valid,
        stats: this.getStats(),
      };
    } catch (error) {
      logger.logSystemError('otp_health_check', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default OTPService;
