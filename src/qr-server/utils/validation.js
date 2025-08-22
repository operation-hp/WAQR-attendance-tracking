import errorHandler from './errorHandler.js';
const { ValidationErrorHandler } = errorHandler;

/**
 * Phone number validation utility
 */
class PhoneNumberValidator {
  /**
   * Validate phone number format
   * @param {string} phoneNumber - Phone number to validate
   * @returns {Object} - Validation result
   */
  static validate(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return {
        valid: false,
        error: ValidationErrorHandler.missingRequiredField('phoneNumber'),
        normalized: null,
      };
    }

    // Remove formatting characters
    // eslint-disable-next-line no-useless-escape
    const cleaned = phoneNumber.replace(/[\s\-\(\)\+]/g, '');

    // Check if it's all digits after cleaning
    if (!/^\d+$/.test(cleaned)) {
      return {
        valid: false,
        error: ValidationErrorHandler.invalidPhoneNumber(phoneNumber),
        normalized: null,
      };
    }

    // Check length (7-15 digits for international numbers)
    if (cleaned.length < 7 || cleaned.length > 15) {
      return {
        valid: false,
        error: ValidationErrorHandler.invalidPhoneNumber(phoneNumber),
        normalized: null,
      };
    }

    // Normalize to international format
    let normalized = cleaned;
    if (!phoneNumber.startsWith('+')) {
      // If no country code, assume it needs one
      if (cleaned.length === 10 && cleaned.startsWith('0')) {
        // Remove leading 0 for some countries
        normalized = cleaned.substring(1);
      }
      normalized = '+' + normalized;
    } else {
      normalized = '+' + cleaned;
    }

    return {
      valid: true,
      error: null,
      normalized: normalized,
      original: phoneNumber,
      cleaned: cleaned,
    };
  }

  /**
   * Quick validation check
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - True if valid
   */
  static isValid(phoneNumber) {
    return this.validate(phoneNumber).valid;
  }

  /**
   * Normalize phone number
   * @param {string} phoneNumber - Phone number to normalize
   * @returns {string|null} - Normalized phone number or null if invalid
   */
  static normalize(phoneNumber) {
    const result = this.validate(phoneNumber);
    return result.valid ? result.normalized : null;
  }
}

/**
 * OTP validation utility
 */
class OTPValidator {
  /**
   * Validate OTP format
   * @param {string} otp - OTP to validate
   * @returns {Object} - Validation result
   */
  static validate(otp) {
    if (!otp || typeof otp !== 'string') {
      return {
        valid: false,
        error: ValidationErrorHandler.missingRequiredField('otp'),
        normalized: null,
      };
    }

    const trimmed = otp.trim();

    if (trimmed.length === 0) {
      return {
        valid: false,
        error: ValidationErrorHandler.invalidOTP(otp),
        normalized: null,
      };
    }

    // OTP should be exactly 6 characters, alphanumeric
    const otpRegex = /^[A-Za-z0-9]{6}$/;
    if (!otpRegex.test(trimmed)) {
      return {
        valid: false,
        error: ValidationErrorHandler.invalidOTP(otp),
        normalized: null,
      };
    }

    return {
      valid: true,
      error: null,
      normalized: trimmed.toUpperCase(),
      original: otp,
    };
  }

  /**
   * Quick validation check
   * @param {string} otp - OTP to validate
   * @returns {boolean} - True if valid
   */
  static isValid(otp) {
    return this.validate(otp).valid;
  }

  /**
   * Normalize OTP
   * @param {string} otp - OTP to normalize
   * @returns {string|null} - Normalized OTP or null if invalid
   */
  static normalize(otp) {
    const result = this.validate(otp);
    return result.valid ? result.normalized : null;
  }
}

/**
 * Timestamp validation utility
 */
class TimestampValidator {
  /**
   * Validate timestamp
   * @param {string|number|Date} timestamp - Timestamp to validate
   * @param {number} toleranceMs - Tolerance in milliseconds (default: 5 minutes)
   * @returns {Object} - Validation result
   */
  static validate(timestamp, toleranceMs = 5 * 60 * 1000) {
    if (!timestamp) {
      return {
        valid: true, // Timestamp is optional, will use current time
        error: null,
        normalized: new Date(),
        original: timestamp,
      };
    }

    let date;
    try {
      date = new Date(timestamp);
    } catch (error) {
      return {
        valid: false,
        rawError: error,
        error: ValidationErrorHandler.invalidTimestamp(timestamp),
        normalized: null,
      };
    }

    if (isNaN(date.getTime())) {
      return {
        valid: false,
        error: ValidationErrorHandler.invalidTimestamp(timestamp),
        normalized: null,
      };
    }

    // Check if timestamp is within tolerance of current time
    const now = Date.now();
    const timeDiff = Math.abs(date.getTime() - now);

    if (timeDiff > toleranceMs) {
      return {
        valid: false,
        error: ValidationErrorHandler.invalidTimestamp(timestamp),
        normalized: null,
      };
    }

    return {
      valid: true,
      error: null,
      normalized: date,
      original: timestamp,
      timeDiff: timeDiff,
    };
  }

  /**
   * Quick validation check
   * @param {string|number|Date} timestamp - Timestamp to validate
   * @param {number} toleranceMs - Tolerance in milliseconds
   * @returns {boolean} - True if valid
   */
  static isValid(timestamp, toleranceMs = 5 * 60 * 1000) {
    return this.validate(timestamp, toleranceMs).valid;
  }
}

/**
 * Date validation utility
 */
class DateValidator {
  /**
   * Validate date string
   * @param {string} dateString - Date string to validate
   * @returns {Object} - Validation result
   */
  static validate(dateString) {
    if (!dateString || typeof dateString !== 'string') {
      return {
        valid: false,
        error: ValidationErrorHandler.missingRequiredField('date'),
        normalized: null,
      };
    }

    let date;
    try {
      date = new Date(dateString);
    } catch (error) {
      return {
        valid: false,
        rawError: error,
        error: new ValidationErrorHandler.constructor(
          'INVALID_DATE_FORMAT',
          'Date must be in valid ISO format (YYYY-MM-DD)',
          400,
          { providedValue: dateString },
        ),
        normalized: null,
      };
    }

    if (isNaN(date.getTime())) {
      return {
        valid: false,
        error: new ValidationErrorHandler.constructor(
          'INVALID_DATE_FORMAT',
          'Date must be in valid ISO format (YYYY-MM-DD)',
          400,
          { providedValue: dateString },
        ),
        normalized: null,
      };
    }

    return {
      valid: true,
      error: null,
      normalized: date,
      original: dateString,
    };
  }

  /**
   * Validate date range
   * @param {string} startDate - Start date string
   * @param {string} endDate - End date string
   * @returns {Object} - Validation result
   */
  static validateRange(startDate, endDate) {
    const startResult = this.validate(startDate);
    if (!startResult.valid) {
      return {
        valid: false,
        error: startResult.error,
        startDate: null,
        endDate: null,
      };
    }

    const endResult = this.validate(endDate);
    if (!endResult.valid) {
      return {
        valid: false,
        error: endResult.error,
        startDate: null,
        endDate: null,
      };
    }

    if (startResult.normalized > endResult.normalized) {
      return {
        valid: false,
        error: new ValidationErrorHandler.constructor(
          'INVALID_DATE_RANGE',
          'Start date must be before or equal to end date',
          400,
          { startDate, endDate },
        ),
        startDate: null,
        endDate: null,
      };
    }

    return {
      valid: true,
      error: null,
      startDate: startResult.normalized,
      endDate: endResult.normalized,
    };
  }
}

/**
 * Numeric validation utility
 */
class NumericValidator {
  /**
   * Validate limit parameter
   * @param {string|number} limit - Limit value to validate
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @returns {Object} - Validation result
   */
  static validateLimit(limit, min = 1, max = 1000) {
    if (!limit) {
      return {
        valid: true,
        error: null,
        normalized: 100, // Default limit
        original: limit,
      };
    }

    const numericLimit = parseInt(limit, 10);

    if (isNaN(numericLimit)) {
      return {
        valid: false,
        error: new ValidationErrorHandler.constructor(
          'INVALID_LIMIT',
          `Limit must be a number between ${min} and ${max}`,
          400,
          { providedValue: limit, min, max },
        ),
        normalized: null,
      };
    }

    if (numericLimit < min || numericLimit > max) {
      return {
        valid: false,
        error: new ValidationErrorHandler.constructor(
          'INVALID_LIMIT',
          `Limit must be a number between ${min} and ${max}`,
          400,
          { providedValue: limit, min, max },
        ),
        normalized: null,
      };
    }

    return {
      valid: true,
      error: null,
      normalized: numericLimit,
      original: limit,
    };
  }
}

/**
 * Request validation middleware factory
 * @param {Object} validationRules - Validation rules
 * @returns {Function} - Express middleware function
 */
function createValidationMiddleware(validationRules) {
  return (req, res, next) => {
    const errors = [];
    const validatedData = {};

    // Validate each field according to rules
    for (const [field, rules] of Object.entries(validationRules)) {
      const value = req.body[field] || req.params[field] || req.query[field];

      if (rules.required && !value) {
        errors.push(ValidationErrorHandler.missingRequiredField(field));
        continue;
      }

      if (!value && !rules.required) {
        continue; // Skip optional fields that are not provided
      }

      let validationResult;

      switch (rules.type) {
        case 'phone':
          validationResult = PhoneNumberValidator.validate(value);
          break;
        case 'otp':
          validationResult = OTPValidator.validate(value);
          break;
        case 'timestamp':
          validationResult = TimestampValidator.validate(
            value,
            rules.tolerance,
          );
          break;
        case 'date':
          validationResult = DateValidator.validate(value);
          break;
        case 'limit':
          validationResult = NumericValidator.validateLimit(
            value,
            rules.min,
            rules.max,
          );
          break;
        default:
          continue; // Skip unknown validation types
      }

      if (!validationResult.valid) {
        errors.push(validationResult.error);
      } else {
        validatedData[field] = validationResult.normalized;
      }
    }

    if (errors.length > 0) {
      // Return first validation error
      const error = errors[0];
      return res.status(error.statusCode).json(error.toJSON());
    }

    // Add validated data to request
    req.validated = validatedData;
    next();
  };
}

export default {
  PhoneNumberValidator,
  OTPValidator,
  TimestampValidator,
  DateValidator,
  NumericValidator,
  createValidationMiddleware,
};
