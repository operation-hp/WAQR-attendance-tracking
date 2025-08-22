export const envConfig = {
  PHONE_NUMBER: process.env.PHONE_NUMBER ?? '',
  ENVIRONMENT: process.env.NODE_ENV || 'development',
  WHATSAPP_PORT: Number(process.env.WHATSAPP_PORT ?? '8001'),
  DEFAULT_SHEET: {
    ID: process.env.DEFAULT_SHEET_ID ?? '',
    TRACKING: process.env.DEFAULT_TRACKING_SHEET_NAME ?? '',
    LEAVES: process.env.DEFAULT_LEAVES_SHEET_NAME ?? '',
    NAME_LIST: process.env.DEFAULT_NAME_LIST_SHEET_NAME ?? '',
  },
  ATTENDANCE_API_URL:
    process.env.ATTENDANCE_API_URL ?? 'http://localhost:3001/api',
  ATTENDANCE_QR_CODE_URL:
    process.env.ATTENDANCE_QR_CODE_URL ?? 'http://localhost:3001',
  TIME_ZONE: process.env.TIME_ZONE ?? 'Asia/Hong_Kong',
  APPS_SCRIPT_API_KEY: process.env.APPS_SCRIPT_API_KEY ?? '',
  APPS_SCRIPT_WEB_APP_URL: process.env.APPS_SCRIPT_WEB_APP_URL ?? '',
  QR_CODE_SERVER: {
    OTP_SECRET: process.env.QR_CODE_SERVER_OTP_SECRET ?? '',
    DATABASE_PATH: process.env.QR_CODE_SERVER_DATABASE_PATH ?? '',
    RATE_LIMIT_WINDOW_MS: Number(
      process.env.QR_CODE_SERVER_RATE_LIMIT_WINDOW_MS ?? '60000',
    ),
    RATE_LIMIT_MAX: Number(process.env.QR_CODE_SERVER_RATE_LIMIT_MAX ?? '10'),
    DEFAULT_TIME_WINDOW_MS: Number(
      process.env.QR_CODE_SERVER_DEFAULT_TIME_WINDOW_MS ?? '30000',
    ),
    WHATSAPP_MESSAGE_TEMPLATE: process.env.QR_CODE_SERVER_WHATSAPP_MESSAGE_TEMPLATE ?? 'Check-in code: {otp}',
  },
};
