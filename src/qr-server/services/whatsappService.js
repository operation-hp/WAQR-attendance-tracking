import { envConfig } from '#src/configs/environment.js';

/**
 * WhatsApp URL Generation Service
 * Handles creation of WhatsApp chat URLs with pre-filled OTP messages
 */
class WhatsAppService {
  constructor(config = {}) {
    // Default WhatsApp number - should be configured via environment or database
    this.whatsappNumber = config.whatsappNumber || envConfig.PHONE_NUMBER;
    this.messageTemplate = config.messageTemplate || 'Check-in code: {otp}';
    this.fallbackToWeb = config.fallbackToWeb !== false; // Default to true
  }

  /**
   * Generate WhatsApp chat URL with pre-filled OTP message
   * @param {string} otp - The OTP code to include in the message
   * @param {Object} options - Additional options for URL generation
   * @returns {string} - Complete WhatsApp URL
   */
  generateWhatsAppURL(otp, options = {}) {
    if (!otp || typeof otp !== 'string') {
      throw new Error('OTP must be a non-empty string');
    }

    // Normalize OTP (uppercase, trim)
    const normalizedOTP = otp.trim().toUpperCase();

    // Validate OTP format (6 characters, alphanumeric)
    if (!/^[A-Z0-9]{6}$/.test(normalizedOTP)) {
      throw new Error('OTP must be 6 alphanumeric characters');
    }

    // Generate message from template
    let message = this.messageTemplate.replace('{otp}', normalizedOTP);

    // Add timestamp if requested
    if (options.includeTimestamp) {
      const timestamp = new Date().toLocaleString();
      message += ` (Generated: ${timestamp})`;
    }

    // Clean and validate WhatsApp number
    const cleanNumber = this.cleanWhatsAppNumber(this.whatsappNumber);

    // Generate WhatsApp URL with proper encoding
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

    return whatsappURL;
  }

  /**
   * Generate WhatsApp Web URL (fallback for devices without WhatsApp app)
   * @param {string} otp - The OTP code to include in the message
   * @param {Object} options - Additional options for URL generation
   * @returns {string} - WhatsApp Web URL
   */
  generateWhatsAppWebURL(otp, options = {}) {
    if (!otp || typeof otp !== 'string') {
      throw new Error('OTP must be a non-empty string');
    }

    const normalizedOTP = otp.trim().toUpperCase();
    let message = this.messageTemplate.replace('{otp}', normalizedOTP);

    if (options.includeTimestamp) {
      const timestamp = new Date().toLocaleString();
      message += ` (Generated: ${timestamp})`;
    }

    const cleanNumber = this.cleanWhatsAppNumber(this.whatsappNumber);
    const encodedMessage = encodeURIComponent(message);

    return `https://web.whatsapp.com/send?phone=${cleanNumber}&text=${encodedMessage}`;
  }

  /**
   * Clean and validate WhatsApp phone number
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} - Cleaned phone number without + prefix
   */
  cleanWhatsAppNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('WhatsApp number must be a non-empty string');
    }

    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Validate length (7-15 digits for international numbers)
    if (cleaned.length < 7 || cleaned.length > 15) {
      throw new Error('WhatsApp number must be 7-15 digits long');
    }

    // Ensure it doesn't start with 0 (international format)
    if (cleaned.startsWith('0')) {
      throw new Error(
        'WhatsApp number must be in international format (no leading zero)',
      );
    }

    return cleaned;
  }

  /**
   * Validate WhatsApp URL format
   * @param {string} url - URL to validate
   * @returns {boolean} - True if URL is valid WhatsApp format
   */
  validateWhatsAppURL(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Check if it's a valid WhatsApp URL pattern
    const whatsappPattern = /^https:\/\/(wa\.me|web\.whatsapp\.com)\//;
    return whatsappPattern.test(url);
  }

  /**
   * Extract OTP from WhatsApp URL
   * @param {string} url - WhatsApp URL
   * @returns {string|null} - Extracted OTP or null if not found
   */
  extractOTPFromURL(url) {
    if (!this.validateWhatsAppURL(url)) {
      return null;
    }

    try {
      const urlObj = new URL(url);
      const text = urlObj.searchParams.get('text');

      if (!text) {
        return null;
      }

      // Decode the message
      const decodedText = decodeURIComponent(text);

      // Extract OTP using regex (6 alphanumeric characters)
      const otpMatch = decodedText.match(/\b[A-Z0-9]{6}\b/);
      return otpMatch ? otpMatch[0] : null;
    } catch (error) {
      console.error('Error extracting OTP from URL:', error);
      return null;
    }
  }

  /**
   * Update WhatsApp configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.whatsappNumber) {
      // Validate the new number
      this.cleanWhatsAppNumber(config.whatsappNumber);
      this.whatsappNumber = config.whatsappNumber;
    }

    if (config.messageTemplate) {
      if (!config.messageTemplate.includes('{otp}')) {
        throw new Error('Message template must include {otp} placeholder');
      }
      this.messageTemplate = config.messageTemplate;
    }

    if (typeof config.fallbackToWeb === 'boolean') {
      this.fallbackToWeb = config.fallbackToWeb;
    }
  }

  /**
   * Get current configuration
   * @returns {Object} - Current service configuration
   */
  getConfig() {
    return {
      whatsappNumber: this.whatsappNumber,
      messageTemplate: this.messageTemplate,
      fallbackToWeb: this.fallbackToWeb,
    };
  }

  /**
   * Generate multiple URL formats for different use cases
   * @param {string} otp - The OTP code
   * @param {Object} options - Generation options
   * @returns {Object} - Object containing different URL formats
   */
  generateAllFormats(otp, options = {}) {
    const urls = {
      mobile: this.generateWhatsAppURL(otp, options),
      web: this.generateWhatsAppWebURL(otp, options),
    };

    // Add QR code friendly format (shorter for better QR code readability)
    if (options.qrOptimized) {
      const shortMessage = `Code: ${otp.trim().toUpperCase()}`;
      const encodedShortMessage = encodeURIComponent(shortMessage);
      const cleanNumber = this.cleanWhatsAppNumber(this.whatsappNumber);
      urls.qr = `https://wa.me/${cleanNumber}?text=${encodedShortMessage}`;
    }

    return urls;
  }

  /**
   * Test WhatsApp URL generation with sample data
   * @returns {Object} - Test results
   */
  testURLGeneration() {
    const testOTP = 'ABC123';
    const results = {
      success: true,
      tests: [],
      errors: [],
    };

    try {
      // Test basic URL generation
      const basicURL = this.generateWhatsAppURL(testOTP);
      results.tests.push({
        name: 'Basic URL Generation',
        input: testOTP,
        output: basicURL,
        valid: this.validateWhatsAppURL(basicURL),
      });

      // Test Web URL generation
      const webURL = this.generateWhatsAppWebURL(testOTP);
      results.tests.push({
        name: 'Web URL Generation',
        input: testOTP,
        output: webURL,
        valid: this.validateWhatsAppURL(webURL),
      });

      // Test OTP extraction
      const extractedOTP = this.extractOTPFromURL(basicURL);
      results.tests.push({
        name: 'OTP Extraction',
        input: basicURL,
        output: extractedOTP,
        valid: extractedOTP === testOTP,
      });

      // Test all formats
      const allFormats = this.generateAllFormats(testOTP, {
        qrOptimized: true,
      });
      results.tests.push({
        name: 'All Formats Generation',
        input: testOTP,
        output: allFormats,
        valid: Object.values(allFormats).every((url) =>
          this.validateWhatsAppURL(url),
        ),
      });
    } catch (error) {
      results.success = false;
      results.errors.push(error.message);
    }

    return results;
  }
}

export default WhatsAppService;
