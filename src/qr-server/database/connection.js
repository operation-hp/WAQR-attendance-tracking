import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import sqlite3 from 'sqlite3';

import errorHandler from '../utils/errorHandler.js';
import logger from '../utils/logger.js';

const { DatabaseErrorHandler } = errorHandler;

const __dirname = dirname(fileURLToPath(import.meta.url));

class DatabaseConnection {
  constructor(dbPath = null) {
    this.dbPath = dbPath || join(__dirname, '../data/checkin.db');
    this.db = null;
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Initialize database connection with retry logic
   * @returns {Promise<sqlite3.Database>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Ensure data directory exists
        const dataDir = dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
          logger.info('Created database directory', { path: dataDir });
        }

        this._attemptConnection(resolve, reject);
      } catch (error) {
        logger.logSystemError('database_connection', error, {
          dbPath: this.dbPath,
        });
        reject(
          DatabaseErrorHandler.handleConnectionError(
            error,
            'database connection',
          ),
        );
      }
    });
  }

  /**
   * Attempt database connection with retry logic
   * @private
   */
  async _attemptConnection(resolve, reject) {
    this.db = new sqlite3.Database(this.dbPath, async (err) => {
      if (err) {
        this.connectionRetries++;
        logger.error('Database connection attempt failed', {
          attempt: this.connectionRetries,
          maxRetries: this.maxRetries,
          error: err.message,
          dbPath: this.dbPath,
        });

        if (this.connectionRetries < this.maxRetries) {
          logger.info(`Retrying database connection in ${this.retryDelay}ms...`);
          setTimeout(() => {
            this._attemptConnection(resolve, reject);
          }, this.retryDelay);
          return;
        }

        reject(
          DatabaseErrorHandler.handleConnectionError(
            err,
            'database connection',
          ),
        );
        return;
      }

      try {
        // Enable foreign keys and other pragmas
        await this._configurePragmas();

        // Test the connection
        await this._testConnection();

        this.isConnected = true;
        this.connectionRetries = 0;

        logger.info('Database connected successfully', {
          dbPath: this.dbPath,
          attempts: this.connectionRetries + 1,
        });

        resolve(this.db);
      } catch (configError) {
        logger.logSystemError('database_configuration', configError, {
          dbPath: this.dbPath,
        });
        reject(
          DatabaseErrorHandler.handleConnectionError(
            configError,
            'database configuration',
          ),
        );
      }
    });
  }

  /**
   * Configure database pragmas
   * @private
   */
  async _configurePragmas() {
    return new Promise((resolve) => {
      const pragmas = [
        'PRAGMA foreign_keys = ON',
        'PRAGMA journal_mode = WAL',
        'PRAGMA synchronous = NORMAL',
        'PRAGMA cache_size = 1000',
        'PRAGMA temp_store = MEMORY',
      ];

      let completed = 0;
      const total = pragmas.length;

      pragmas.forEach((pragma) => {
        this.db.run(pragma, (err) => {
          if (err) {
            logger.warn('Failed to set pragma', { pragma, error: err.message });
          }

          completed++;
          if (completed === total) {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Test database connection
   * @private
   */
  async _testConnection() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT 1 as test', (err, row) => {
        if (err) {
          reject(err);
        } else if (row && row.test === 1) {
          resolve();
        } else {
          reject(new Error('Database connection test failed'));
        }
      });
    });
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db && this.isConnected) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database connection', {
              error: err.message,
            });
            reject(
              DatabaseErrorHandler.handleConnectionError(err, 'database close'),
            );
          } else {
            logger.info('Database connection closed successfully');
            this.db = null;
            this.isConnected = false;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get database instance
   * @returns {sqlite3.Database}
   */
  getDatabase() {
    if (!this.db || !this.isConnected) {
      throw DatabaseErrorHandler.handleConnectionError(
        new Error('Database not connected'),
        'get database instance',
      );
    }
    return this.db;
  }

  /**
   * Check if database is connected
   * @returns {boolean}
   */
  isConnectedToDatabase() {
    return this.isConnected && this.db !== null;
  }

  /**
   * Reconnect to database
   * @returns {Promise<sqlite3.Database>}
   */
  async reconnect() {
    logger.info('Attempting to reconnect to database');

    if (this.isConnected) {
      await this.close();
    }

    this.connectionRetries = 0;
    return this.connect();
  }

  /**
   * Execute a query with parameters and error handling
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>}
   */
  async run(sql, params = []) {
    if (!this.isConnectedToDatabase()) {
      throw DatabaseErrorHandler.handleConnectionError(
        new Error('Database not connected'),
        'run query',
      );
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.db.run(sql, params, function (err) {
        const duration = Date.now() - startTime;

        logger.logDatabaseOperation('run', {
          sql: sql.substring(0, 100),
          paramCount: params.length,
          duration,
          error: err ? err.message : null,
        });

        if (err) {
          reject(DatabaseErrorHandler.handleQueryError(err, sql, params));
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes,
            duration,
          });
        }
      });
    });
  }

  /**
   * Get a single row with error handling
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object|undefined>}
   */
  async get(sql, params = []) {
    if (!this.isConnectedToDatabase()) {
      throw DatabaseErrorHandler.handleConnectionError(
        new Error('Database not connected'),
        'get query',
      );
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.db.get(sql, params, (err, row) => {
        const duration = Date.now() - startTime;

        logger.logDatabaseOperation('get', {
          sql: sql.substring(0, 100),
          paramCount: params.length,
          duration,
          hasResult: !!row,
          error: err ? err.message : null,
        });

        if (err) {
          reject(DatabaseErrorHandler.handleQueryError(err, sql, params));
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all rows with error handling
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>}
   */
  async all(sql, params = []) {
    if (!this.isConnectedToDatabase()) {
      throw DatabaseErrorHandler.handleConnectionError(
        new Error('Database not connected'),
        'all query',
      );
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      this.db.all(sql, params, (err, rows) => {
        const duration = Date.now() - startTime;

        logger.logDatabaseOperation('all', {
          sql: sql.substring(0, 100),
          paramCount: params.length,
          duration,
          rowCount: rows ? rows.length : 0,
          error: err ? err.message : null,
        });

        if (err) {
          reject(DatabaseErrorHandler.handleQueryError(err, sql, params));
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get database health status
   * @returns {Promise<Object>}
   */
  async getHealthStatus() {
    try {
      const startTime = Date.now();
      await this._testConnection();
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        connected: this.isConnected,
        responseTime,
        dbPath: this.dbPath,
        retries: this.connectionRetries,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        dbPath: this.dbPath,
        retries: this.connectionRetries,
      };
    }
  }
}

export default DatabaseConnection;
