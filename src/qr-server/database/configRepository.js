import DatabaseConnection from './connection.js';

class ConfigRepository {
  constructor(dbConnection = null) {
    this.dbConnection = dbConnection || new DatabaseConnection();
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @returns {Promise<string|null>} - Configuration value or null if not found
   */
  async getConfig(key) {
    const sql = 'SELECT value FROM system_config WHERE key = ?';

    try {
      const result = await this.dbConnection.get(sql, [key]);
      return result ? result.value : null;
    } catch (error) {
      console.error('Error fetching config:', error);
      throw new Error(`Failed to fetch configuration for key: ${key}`);
    }
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {string} value - Configuration value
   * @returns {Promise<void>}
   */
  async setConfig(key, value) {
    const sql = `
            INSERT OR REPLACE INTO system_config (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `;

    try {
      await this.dbConnection.run(sql, [key, value]);
    } catch (error) {
      console.error('Error setting config:', error);
      throw new Error(`Failed to set configuration for key: ${key}`);
    }
  }

  /**
   * Get all configuration values
   * @returns {Promise<Object>} - Object with all configuration key-value pairs
   */
  async getAllConfig() {
    const sql = 'SELECT key, value FROM system_config';

    try {
      const results = await this.dbConnection.all(sql);
      const config = {};
      results.forEach((row) => {
        config[row.key] = row.value;
      });
      return config;
    } catch (error) {
      console.error('Error fetching all config:', error);
      throw new Error('Failed to fetch all configuration');
    }
  }

  /**
   * Delete a configuration value
   * @param {string} key - Configuration key to delete
   * @returns {Promise<boolean>} - True if deleted, false if key didn't exist
   */
  async deleteConfig(key) {
    const sql = 'DELETE FROM system_config WHERE key = ?';

    try {
      const result = await this.dbConnection.run(sql, [key]);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting config:', error);
      throw new Error(`Failed to delete configuration for key: ${key}`);
    }
  }

  /**
   * Get the OTP secret key
   * @returns {Promise<string>} - OTP secret key
   */
  async getOtpSecret() {
    const secret = await this.getConfig('otp_secret');
    if (!secret) {
      throw new Error(
        'OTP secret not configured. Run database initialization.',
      );
    }
    return secret;
  }

  /**
   * Update the OTP secret key
   * @param {string} newSecret - New OTP secret key
   * @returns {Promise<void>}
   */
  async setOtpSecret(newSecret) {
    await this.setConfig('otp_secret', newSecret);
  }
}

export default ConfigRepository;
