#!/usr/bin/env node

/**
 * Database initialization script
 * Usage: npm run init-db
 */

import { randomBytes } from 'crypto';

import DatabaseConnection from '../database/connection.js';
import { initializeSchema } from '../database/schema.js';

import { envConfig } from '#src/configs/environment.js';

async function initializeDatabase() {
  const dbConnection = new DatabaseConnection();

  try {
    console.log('Starting database initialization...');

    // Connect to database
    await dbConnection.connect();

    // Generate a default secret key if not provided via environment
    const secretKey =
      envConfig.QR_CODE_SERVER.OTP_SECRET || randomBytes(32).toString('hex');

    if (!envConfig.QR_CODE_SERVER.OTP_SECRET) {
      console.log(
        '⚠️  No QR_CODE_SERVER.OTP_SECRET environment variable found.',
      );
      console.log('Generated a random secret key for development.');
      console.log(
        'For production, set QR_CODE_SERVER.OTP_SECRET environment variable.',
      );
      console.log(`Generated key: ${secretKey}`);
    }

    // Initialize schema
    await initializeSchema(dbConnection, secretKey);

    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await dbConnection.close();
  }
}

initializeDatabase();

export default { initializeDatabase };
