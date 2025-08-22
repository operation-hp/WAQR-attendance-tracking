/**
 * Database schema definitions and initialization
 */

const CREATE_CHECK_INS_TABLE = `
    CREATE TABLE IF NOT EXISTS check_ins (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        phone_number TEXT NOT NULL,
        otp TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'expired', 'invalid')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

const CREATE_SYSTEM_CONFIG_TABLE = `
    CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

const CREATE_CHECK_INS_DATE_INDEX = `
    CREATE INDEX IF NOT EXISTS idx_checkins_date 
    ON check_ins(DATE(timestamp))
`;

const CREATE_CHECK_INS_PHONE_INDEX = `
    CREATE INDEX IF NOT EXISTS idx_checkins_phone 
    ON check_ins(phone_number)
`;

const CREATE_CHECK_INS_TIMESTAMP_INDEX = `
    CREATE INDEX IF NOT EXISTS idx_checkins_timestamp 
    ON check_ins(timestamp)
`;

const INSERT_DEFAULT_CONFIG = `
    INSERT OR IGNORE INTO system_config (key, value) 
    VALUES ('otp_secret', ?)
`;

/**
 * Initialize database schema
 * @param {DatabaseConnection} dbConnection - Database connection instance
 * @param {string} secretKey - OTP secret key
 * @returns {Promise<void>}
 */
async function initializeSchema(dbConnection, secretKey = null) {
  try {
    console.log('Initializing database schema...');

    // Create tables
    await dbConnection.run(CREATE_CHECK_INS_TABLE);
    console.log('✓ check_ins table created/verified');

    await dbConnection.run(CREATE_SYSTEM_CONFIG_TABLE);
    console.log('✓ system_config table created/verified');

    // Create indexes
    await dbConnection.run(CREATE_CHECK_INS_DATE_INDEX);
    console.log('✓ Date index created/verified');

    await dbConnection.run(CREATE_CHECK_INS_PHONE_INDEX);
    console.log('✓ Phone number index created/verified');

    await dbConnection.run(CREATE_CHECK_INS_TIMESTAMP_INDEX);
    console.log('✓ Timestamp index created/verified');

    // Insert default configuration
    if (secretKey) {
      await dbConnection.run(INSERT_DEFAULT_CONFIG, [secretKey]);
      console.log('✓ Default OTP secret configured');
    }

    console.log('Database schema initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database schema:', error);
    throw error;
  }
}

/**
 * Drop all tables (for testing purposes)
 * @param {DatabaseConnection} dbConnection - Database connection instance
 * @returns {Promise<void>}
 */
async function dropSchema(dbConnection) {
  try {
    await dbConnection.run('DROP TABLE IF EXISTS check_ins');
    await dbConnection.run('DROP TABLE IF EXISTS system_config');
    console.log('Database schema dropped successfully');
  } catch (error) {
    console.error('Error dropping database schema:', error);
    throw error;
  }
}

export {
  initializeSchema,
  dropSchema,
  CREATE_CHECK_INS_TABLE,
  CREATE_SYSTEM_CONFIG_TABLE,
  CREATE_CHECK_INS_DATE_INDEX,
  CREATE_CHECK_INS_PHONE_INDEX,
  CREATE_CHECK_INS_TIMESTAMP_INDEX,
};
