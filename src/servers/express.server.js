import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import QRCode from 'qrcode';

import { envConfig } from '#src/configs/environment.js';
import qrDatabase from '#src/qr-server/database/index.js';
import OTPService from '#src/qr-server/services/otpService.js';
import WhatsAppService from '#src/qr-server/services/whatsappService.js';
import errorHandler from '#src/qr-server/utils/errorHandler.js';
import logger from '#src/qr-server/utils/logger.js';
import validation from '#src/qr-server/utils/validation.js';

const {
  createValidationMiddleware,
  OTPValidator,
  PhoneNumberValidator,
  NumericValidator,
  DateValidator,
} = validation;

const {
  asyncHandler,
  createDegradedResponse,
  ERROR_CODES,
  ServiceErrorHandler,
} = errorHandler;

const { DatabaseConnection, CheckInRepository, ConfigRepository } = qrDatabase;

const __dirname = dirname(fileURLToPath(import.meta.url));

// Initialize services
let otpService;
let whatsappService;
let checkInRepository;
let configRepository;

// Initialize services with database config and comprehensive error handling
async function initializeQRServices() {
  try {
    logger.info('Starting service initialization');

    // Initialize database connection
    const dbConnection = new DatabaseConnection();
    await dbConnection.connect();

    configRepository = new ConfigRepository(dbConnection);
    checkInRepository = new CheckInRepository(dbConnection);

    // Get OTP secret from database or use environment variable
    let otpSecret;
    try {
      otpSecret = await configRepository.getOtpSecret();
      logger.info('OTP secret loaded from database');
    } catch (error) {
      logger.warn(
        'OTP secret not found in database, using environment variable',
        {
          error: error.message,
        },
      );
      otpSecret =
        envConfig.QR_CODE_SERVER.OTP_SECRET ||
        'default-secret-key-change-in-production';

      if (otpSecret === 'default-secret-key-change-in-production') {
        logger.warn(
          'Using default OTP secret key - change this in production!',
        );
      }
    }

    // Initialize OTP service
    try {
      otpService = new OTPService(otpSecret);
      logger.info('OTP service initialized successfully');
    } catch (error) {
      logger.logSystemError('otp_service_init', error);
      throw ServiceErrorHandler.handleOTPServiceError(error, 'initialization');
    }

    // Initialize WhatsApp service with configuration
    try {
      const whatsappConfig = {
        whatsappNumber: envConfig.PHONE_NUMBER,
        messageTemplate:
          envConfig.QR_CODE_SERVER.WHATSAPP_MESSAGE_TEMPLATE ||
          'Check-in code: {otp}',
      };
      whatsappService = new WhatsAppService(whatsappConfig);
      logger.info('WhatsApp service initialized successfully', {
        whatsappNumber: whatsappConfig.whatsappNumber,
      });
    } catch (error) {
      logger.logSystemError('whatsapp_service_init', error);
      throw ServiceErrorHandler.handleWhatsAppServiceError(
        error,
        'initialization',
      );
    }

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.logSystemError('service_initialization', error);
    logger.error('Failed to initialize services - shutting down', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Rate limiting with enhanced logging
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: 'Too many requests, please try again later',
    },
  },
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
    });
    res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests, please try again later',
      },
    });
  },
});

const checkInLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 check-in attempts per minute
  message: {
    success: false,
    error: {
      code: ERROR_CODES.CHECKIN_RATE_LIMIT,
      message: 'Too many check-in attempts, please try again later',
    },
  },
  handler: (req, res) => {
    logger.warn('Check-in rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      phoneNumber: req.body.phoneNumber
        ? logger.maskPhoneNumber(req.body.phoneNumber)
        : 'unknown',
    });
    res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.CHECKIN_RATE_LIMIT,
        message: 'Too many check-in attempts, please try again later',
      },
    });
  },
});

// Middleware
const isProd = process.env.NODE_ENV === 'production';

const EXTRA = (process.env.ALLOW_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export class ExpressServer {
  constructor(client) {
    this.client = client;
    this.app = express();
    this.port = envConfig.WHATSAPP_PORT;

    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(bodyParser.json());
    this.app.use(cors());
    this.app.use(
      helmet({
        contentSecurityPolicy: isProd
          ? {
              useDefaults: true,
              directives: {
                'default-src': ["'self'"],
                'script-src': ["'self'", ...EXTRA],
                'style-src': ["'self'", "'unsafe-inline'", ...EXTRA],
                'img-src': ["'self'", 'data:', 'https:', ...EXTRA],
                'connect-src': ["'self'", ...EXTRA],
                'font-src': ["'self'", ...EXTRA],
                'media-src': ["'self'", ...EXTRA],
                'object-src': ["'none'"],
                'frame-src': ["'none'"],
                'upgrade-insecure-requests': [],
              },
            }
          : false,

        crossOriginOpenerPolicy: isProd ? { policy: 'same-origin' } : false,
        crossOriginResourcePolicy: isProd
          ? { policy: 'same-site' }
          : { policy: 'cross-origin' },

        referrerPolicy: {
          policy: isProd ? 'no-referrer' : 'strict-origin-when-cross-origin',
        },
      }),
    );
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.static(path.join(__dirname, '../qr-server/public')));
    this.app.use('/api', apiLimiter);
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

        logger[logLevel]('HTTP Request', {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      });

      next();
    });
  }

  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).send({ error: 'Unauthorized: No token provided' });
    }

    if (token !== process.env.SECRET_KEY) {
      return res.status(403).send({ error: 'Forbidden: Invalid token' });
    }

    next();
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        client_ready: this.client?.info?.pushname ? true : false,
      });
    });

    // Health check endpoint with comprehensive status
    this.app.get(
      '/health',
      asyncHandler(async (req, res) => {
        try {
          const healthStatus = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
              otp: otpService ? 'available' : 'unavailable',
              whatsapp: whatsappService ? 'available' : 'unavailable',
              database: 'unknown',
              checkInRepository: 'unknown',
            },
          };

          // Check database health if available
          if (checkInRepository) {
            try {
              const dbHealth = await checkInRepository.getHealthStatus();
              healthStatus.services.database = dbHealth.status;
              healthStatus.services.checkInRepository = dbHealth.status;
              healthStatus.database = dbHealth;
            } catch (error) {
              healthStatus.services.database = 'unhealthy';
              healthStatus.services.checkInRepository = 'unhealthy';
              healthStatus.database = {
                status: 'unhealthy',
                error: error.message,
              };
            }
          }

          // Determine overall status
          const unhealthyServices = Object.values(healthStatus.services).filter(
            (status) => status === 'unavailable' || status === 'unhealthy',
          );

          if (unhealthyServices.length > 0) {
            healthStatus.status = 'degraded';
            res.status(503);
          }

          res.json(healthStatus);
        } catch (error) {
          logger.logSystemError('health_check', error);
          res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message,
          });
        }
      }),
    );

    // API Routes

    /**
     * GET /api/current-otp
     * Returns current OTP and expiry information
     */
    this.app.get(
      '/api/current-otp',
      asyncHandler(async (req, res) => {
        try {
          if (!otpService) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'OTP service is not initialized',
              },
            });
          }

          const otpData = otpService.getCurrentOTP();

          res.json({
            success: true,
            data: {
              otp: otpData.otp,
              expiresIn: otpData.expiresIn,
              expiresAt: otpData.expiresAt,
              nextOtp: otpData.nextOtp,
              generatedAt: otpData.generatedAt,
            },
          });
        } catch (error) {
          console.error('Error getting current OTP:', error);
          res.status(500).json({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to generate current OTP',
            },
          });
        }
      }),
    );

    /**
     * POST /api/checkin
     * Validates OTP and records check-in with comprehensive error handling
     */
    this.app.post(
      '/api/checkin',
      checkInLimiter,
      createValidationMiddleware({
        otp: { type: 'otp', required: true },
        phoneNumber: { type: 'phone', required: true },
        timestamp: {
          type: 'timestamp',
          required: false,
          tolerance: 5 * 60 * 1000,
        },
      }),
      asyncHandler(async (req, res) => {
        const { otp, phoneNumber, timestamp } = req.validated;

        // Check service availability with graceful degradation
        if (!otpService) {
          logger.error('OTP service unavailable during check-in attempt', {
            phoneNumber: logger.maskPhoneNumber(phoneNumber),
            otp: otp ? otp.substring(0, 2) + '****' : null,
          });
          return res
            .status(503)
            .json(
              createDegradedResponse(
                'otp_service',
                'OTP validation service is not available',
              ),
            );
        }

        if (!checkInRepository) {
          logger.error(
            'Check-in repository unavailable during check-in attempt',
            {
              phoneNumber: logger.maskPhoneNumber(phoneNumber),
              otp: otp ? otp.substring(0, 2) + '****' : null,
            },
          );
          return res
            .status(503)
            .json(
              createDegradedResponse(
                'checkin_repository',
                'Check-in recording service is not available',
              ),
            );
        }

        // Use validated timestamp or current time
        const checkInTime = timestamp || new Date();

        try {
          // Validate OTP
          const validation = otpService.validateOTP(otp, checkInTime.getTime());

          // Record check-in regardless of validation result
          const checkInId = await checkInRepository.recordCheckIn(
            phoneNumber,
            otp,
            validation.valid
              ? 'valid'
              : validation.reason === 'EXPIRED_OR_INVALID'
                ? 'expired'
                : 'invalid',
            checkInTime,
          );

          if (validation.valid) {
            logger.info('Check-in successful', {
              checkinId: checkInId,
              phoneNumber: logger.maskPhoneNumber(phoneNumber),
              timeWindow: validation.timeWindow,
              timestamp: checkInTime.toISOString(),
            });

            res.json({
              success: true,
              data: {
                checkinId: checkInId,
                message: validation.message,
                timeWindow: validation.timeWindow,
                timestamp: checkInTime.toISOString(),
              },
            });
          } else {
            logger.warn('Check-in failed validation', {
              checkinId: checkInId,
              phoneNumber: logger.maskPhoneNumber(phoneNumber),
              reason: validation.reason,
              timestamp: checkInTime.toISOString(),
            });

            // Return 410 for expired OTPs, 400 for invalid format/other issues
            const statusCode =
              validation.reason === 'EXPIRED_OR_INVALID' ? 410 : 400;
            res.status(statusCode).json({
              success: false,
              error: {
                code: validation.reason,
                message: validation.message,
                checkinId: checkInId, // Still record the attempt
                timestamp: checkInTime.toISOString(),
              },
            });
          }
        } catch (error) {
          logger.logSystemError('checkin_processing', error, {
            phoneNumber: logger.maskPhoneNumber(phoneNumber),
            timestamp: checkInTime.toISOString(),
          });

          // Try to record failed attempt if possible
          try {
            if (checkInRepository) {
              await checkInRepository.recordCheckIn(
                phoneNumber,
                otp,
                'error',
                checkInTime,
              );
            }
          } catch (recordError) {
            logger.logSystemError('checkin_error_recording', recordError);
          }

          throw error; // Let error middleware handle it
        }
      }),
    );

    /**
     * GET /api/whatsapp-url/:otp
     * Generate WhatsApp URL for a specific OTP
     */
    this.app.get(
      '/api/whatsapp-url/:otp',
      asyncHandler(async (req, res) => {
        try {
          const { otp } = req.params;
          const {
            format = 'mobile',
            qrOptimized = false,
            includeTimestamp = false,
          } = req.query;

          if (!whatsappService) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'WhatsApp service is not initialized',
              },
            });
          }

          // Validate OTP format
          const otpValidation = OTPValidator.validate(otp);
          if (!otpValidation.valid) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_OTP_FORMAT',
                message: 'OTP must be a 6-character alphanumeric string',
              },
            });
          }

          const options = {
            qrOptimized: qrOptimized === 'true',
            includeTimestamp: includeTimestamp === 'true',
          };

          let whatsappURL;

          if (format === 'all') {
            whatsappURL = whatsappService.generateAllFormats(otp, options);
          } else if (format === 'web') {
            whatsappURL = whatsappService.generateWhatsAppWebURL(otp, options);
          } else {
            whatsappURL = whatsappService.generateWhatsAppURL(otp, options);
          }

          res.json({
            success: true,
            data: {
              otp: otp.toUpperCase(),
              url: whatsappURL,
              format: format,
              config: whatsappService.getConfig(),
            },
          });
        } catch (error) {
          console.error('Error generating WhatsApp URL:', error);
          res.status(400).json({
            success: false,
            error: {
              code: 'URL_GENERATION_FAILED',
              message: error.message,
            },
          });
        }
      }),
    );

    /**
     * GET /api/whatsapp-config
     * Get current WhatsApp service configuration
     */
    this.app.get(
      '/api/whatsapp-config',
      asyncHandler(async (req, res) => {
        try {
          if (!whatsappService) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'WhatsApp service is not initialized',
              },
            });
          }

          const config = whatsappService.getConfig();

          res.json({
            success: true,
            data: {
              whatsappNumber: config.whatsappNumber,
              messageTemplate: config.messageTemplate,
              fallbackToWeb: config.fallbackToWeb,
            },
          });
        } catch (error) {
          console.error('Error getting WhatsApp config:', error);
          res.status(500).json({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to get WhatsApp configuration',
            },
          });
        }
      }),
    );

    /**
     * GET /api/qr-code/:otp
     * Generate QR code for WhatsApp URL with OTP
     */
    this.app.get(
      '/api/qr-code/:otp',
      asyncHandler(async (req, res) => {
        try {
          const { otp } = req.params;
          const { format = 'mobile', size = 200 } = req.query;

          if (!whatsappService) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'WhatsApp service is not initialized',
              },
            });
          }

          // Validate OTP format
          const otpValidation = OTPValidator.validate(otp);
          if (!otpValidation.valid) {
            return res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_OTP_FORMAT',
                message: 'OTP must be a 6-character alphanumeric string',
              },
            });
          }

          // Generate WhatsApp URL
          const options = { qrOptimized: true };
          let whatsappURL;

          if (format === 'web') {
            whatsappURL = whatsappService.generateWhatsAppWebURL(otp, options);
          } else {
            whatsappURL = whatsappService.generateWhatsAppURL(otp, options);
          }

          // Generate QR code as data URL
          const qrCodeDataURL = await QRCode.toDataURL(whatsappURL, {
            width: parseInt(size, 10) || 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
          });

          res.json({
            success: true,
            data: {
              otp: otp.toUpperCase(),
              whatsappURL: whatsappURL,
              qrCodeDataURL: qrCodeDataURL,
              format: format,
              size: parseInt(size, 10) || 200,
            },
          });
        } catch (error) {
          console.error('Error generating QR code:', error);
          res.status(500).json({
            success: false,
            error: {
              code: 'QR_GENERATION_FAILED',
              message: 'Failed to generate QR code',
            },
          });
        }
      }),
    );

    /**
     * GET /api/current-otp-with-qr
     * Returns current OTP with QR code data URL
     */
    this.app.get(
      '/api/current-otp-with-qr',
      asyncHandler(async (req, res) => {
        try {
          if (!otpService || !whatsappService) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Required services are not initialized',
              },
            });
          }

          const { format = 'mobile', size = 200 } = req.query;
          const otpData = otpService.getCurrentOTP();

          // Generate WhatsApp URL
          const options = { qrOptimized: true };
          let whatsappURL;

          if (format === 'web') {
            whatsappURL = whatsappService.generateWhatsAppWebURL(
              otpData.otp,
              options,
            );
          } else {
            whatsappURL = whatsappService.generateWhatsAppURL(
              otpData.otp,
              options,
            );
          }

          // Generate QR code as data URL
          const qrCodeDataURL = await QRCode.toDataURL(whatsappURL, {
            width: parseInt(size, 10) || 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
          });

          res.json({
            success: true,
            data: {
              otp: otpData.otp,
              expiresIn: otpData.expiresIn,
              expiresAt: otpData.expiresAt,
              nextOtp: otpData.nextOtp,
              generatedAt: otpData.generatedAt,
              whatsappURL: whatsappURL,
              qrCodeDataURL: qrCodeDataURL,
              whatsappConfig: whatsappService.getConfig(),
            },
          });
        } catch (error) {
          console.error('Error getting current OTP with QR code:', error);
          res.status(500).json({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to generate current OTP with QR code',
            },
          });
        }
      }),
    );

    /**
     * GET /api/current-otp-with-whatsapp
     * Returns current OTP with WhatsApp URL included
     */
    this.app.get(
      '/api/current-otp-with-whatsapp',
      asyncHandler(async (req, res) => {
        try {
          if (!otpService || !whatsappService) {
            return res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'Required services are not initialized',
              },
            });
          }

          const { format = 'mobile', qrOptimized = 'true' } = req.query;
          const otpData = otpService.getCurrentOTP();

          const options = {
            qrOptimized: qrOptimized === 'true',
          };

          let whatsappURL;
          if (format === 'all') {
            whatsappURL = whatsappService.generateAllFormats(
              otpData.otp,
              options,
            );
          } else if (format === 'web') {
            whatsappURL = whatsappService.generateWhatsAppWebURL(
              otpData.otp,
              options,
            );
          } else {
            whatsappURL = whatsappService.generateWhatsAppURL(
              otpData.otp,
              options,
            );
          }

          res.json({
            success: true,
            data: {
              otp: otpData.otp,
              expiresIn: otpData.expiresIn,
              expiresAt: otpData.expiresAt,
              nextOtp: otpData.nextOtp,
              generatedAt: otpData.generatedAt,
              whatsappURL: whatsappURL,
              whatsappConfig: whatsappService.getConfig(),
            },
          });
        } catch (error) {
          console.error('Error getting current OTP with WhatsApp URL:', error);
          res.status(500).json({
            success: false,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Failed to generate current OTP with WhatsApp URL',
            },
          });
        }
      }),
    );

    /**
     * GET /api/checkins
     * Retrieves check-in records with optional filtering and comprehensive error handling
     */
    this.app.get(
      '/api/checkins',
      asyncHandler(async (req, res) => {
        // Check service availability
        if (!checkInRepository) {
          logger.error(
            'Check-in repository unavailable for checkins retrieval',
          );
          return res
            .status(503)
            .json(
              createDegradedResponse(
                'checkin_repository',
                'Check-in retrieval service is not available',
              ),
            );
        }

        const { date, startDate, endDate, phone, limit } = req.query;
        let checkIns = [];

        try {
          if (phone) {
            // Validate phone number format
            const phoneValidation = PhoneNumberValidator.validate(phone);
            if (!phoneValidation.valid) {
              return res
                .status(phoneValidation.error.statusCode)
                .json(phoneValidation.error.toJSON());
            }

            // Validate limit
            const limitValidation = NumericValidator.validateLimit(
              limit,
              1,
              1000,
            );
            if (!limitValidation.valid) {
              return res
                .status(limitValidation.error.statusCode)
                .json(limitValidation.error.toJSON());
            }

            checkIns = await checkInRepository.getCheckInsByPhone(
              phoneValidation.normalized,
              limitValidation.normalized,
            );

            logger.info('Retrieved check-ins by phone', {
              phoneNumber: logger.maskPhoneNumber(phoneValidation.normalized),
              limit: limitValidation.normalized,
              count: checkIns.length,
            });
          } else if (date) {
            // Single date query
            const dateValidation = DateValidator.validate(date);
            if (!dateValidation.valid) {
              return res
                .status(dateValidation.error.statusCode)
                .json(dateValidation.error.toJSON());
            }

            checkIns = await checkInRepository.getCheckInsByDateRange(
              dateValidation.normalized,
              dateValidation.normalized,
            );

            logger.info('Retrieved check-ins by date', {
              date: dateValidation.normalized.toISOString().split('T')[0],
              count: checkIns.length,
            });
          } else if (startDate && endDate) {
            // Date range query
            const rangeValidation = DateValidator.validateRange(
              startDate,
              endDate,
            );
            if (!rangeValidation.valid) {
              return res
                .status(rangeValidation.error.statusCode)
                .json(rangeValidation.error.toJSON());
            }

            checkIns = await checkInRepository.getCheckInsByDateRange(
              rangeValidation.startDate,
              rangeValidation.endDate,
            );

            logger.info('Retrieved check-ins by date range', {
              startDate: rangeValidation.startDate.toISOString().split('T')[0],
              endDate: rangeValidation.endDate.toISOString().split('T')[0],
              count: checkIns.length,
            });
          } else {
            // Default: today's check-ins
            checkIns = await checkInRepository.getTodaysCheckIns();

            logger.info("Retrieved today's check-ins", {
              count: checkIns.length,
            });
          }

          res.json({
            success: true,
            data: {
              checkins: checkIns,
              count: checkIns.length,
              query: {
                date,
                startDate,
                endDate,
                phone: phone ? logger.maskPhoneNumber(phone) : undefined,
                limit,
              },
            },
          });
        } catch (error) {
          logger.logSystemError('checkins_retrieval', error, {
            query: {
              date,
              startDate,
              endDate,
              phone: phone ? logger.maskPhoneNumber(phone) : undefined,
              limit,
            },
          });
          throw error; // Let error middleware handle it
        }
      }),
    );
  }

  async start() {
    await initializeQRServices();
    const server = this.app.listen(this.port, () => {
      console.info(`Server is running on http://localhost:${this.port}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });

    return server;
  }
}
