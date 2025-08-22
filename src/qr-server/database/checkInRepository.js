import errorHandler from '../utils/errorHandler.js';
const { DatabaseErrorHandler } = errorHandler;
import logger from '../utils/logger.js';

import DatabaseConnection from './connection.js';

class CheckInRepository {
    constructor(dbConnection = null) {
        this.dbConnection = dbConnection || new DatabaseConnection();
    }

    /**
     * Record a new check-in with comprehensive error handling
     * @param {string} phoneNumber - User's phone number
     * @param {string} otp - OTP used for check-in
     * @param {string} validationStatus - 'valid', 'expired', or 'invalid'
     * @param {Date} timestamp - Check-in timestamp
     * @returns {Promise<string>} - Check-in ID
     */
    async recordCheckIn(phoneNumber, otp, validationStatus, timestamp = new Date()) {
        const sql = `
            INSERT INTO check_ins (phone_number, otp, validation_status, timestamp)
            VALUES (?, ?, ?, ?)
        `;
        
        try {
            // Log the check-in attempt
            logger.logCheckInAttempt({
                phoneNumber,
                otp,
                validationStatus,
                timestamp: timestamp.toISOString()
            });

            const result = await this.dbConnection.run(sql, [
                phoneNumber,
                otp,
                validationStatus,
                timestamp.toISOString()
            ]);
            
            // Get the inserted record to return the ID
            const insertedRecord = await this.dbConnection.get(
                'SELECT id FROM check_ins WHERE rowid = ?',
                [result.lastID]
            );
            
            if (!insertedRecord) {
                throw new Error('Failed to retrieve inserted check-in record');
            }

            logger.info('Check-in recorded successfully', {
                checkinId: insertedRecord.id,
                phoneNumber: logger.maskPhoneNumber(phoneNumber),
                validationStatus,
                duration: result.duration
            });
            
            return insertedRecord.id;
        } catch (error) {
            logger.logCheckInAttempt({
                phoneNumber,
                otp,
                validationStatus,
                timestamp: timestamp.toISOString(),
                error
            });
            
            throw DatabaseErrorHandler.handleQueryError(error, sql, [phoneNumber, otp, validationStatus, timestamp.toISOString()]);
        }
    }

    /**
     * Get check-ins for a specific date range with error handling
     * @param {Date} startDate - Start date (inclusive)
     * @param {Date} endDate - End date (inclusive)
     * @returns {Promise<Array>} - Array of check-in records
     */
    async getCheckInsByDateRange(startDate, endDate) {
        const sql = `
            SELECT id, phone_number, otp, validation_status, timestamp, created_at
            FROM check_ins
            WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
            ORDER BY timestamp DESC
        `;
        
        try {
            const params = [startDate.toISOString(), endDate.toISOString()];
            const results = await this.dbConnection.all(sql, params);
            
            logger.debug('Retrieved check-ins by date range', {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                count: results.length
            });
            
            return results;
        } catch (error) {
            logger.logSystemError('checkin_repository', error, {
                operation: 'getCheckInsByDateRange',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });
            
            throw DatabaseErrorHandler.handleQueryError(error, sql, [startDate.toISOString(), endDate.toISOString()]);
        }
    }

    /**
     * Get check-ins for a specific phone number with error handling
     * @param {string} phoneNumber - Phone number to search for
     * @param {number} limit - Maximum number of records to return
     * @returns {Promise<Array>} - Array of check-in records
     */
    async getCheckInsByPhone(phoneNumber, limit = 100) {
        const sql = `
            SELECT id, phone_number, otp, validation_status, timestamp, created_at
            FROM check_ins
            WHERE phone_number = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        
        try {
            const params = [phoneNumber, limit];
            const results = await this.dbConnection.all(sql, params);
            
            logger.debug('Retrieved check-ins by phone', {
                phoneNumber: logger.maskPhoneNumber(phoneNumber),
                limit,
                count: results.length
            });
            
            return results;
        } catch (error) {
            logger.logSystemError('checkin_repository', error, {
                operation: 'getCheckInsByPhone',
                phoneNumber: logger.maskPhoneNumber(phoneNumber),
                limit
            });
            
            throw DatabaseErrorHandler.handleQueryError(error, sql, [phoneNumber, limit]);
        }
    }

    /**
     * Get today's check-ins with error handling
     * @returns {Promise<Array>} - Array of today's check-in records
     */
    async getTodaysCheckIns() {
        const sql = `
            SELECT id, phone_number, otp, validation_status, timestamp, created_at
            FROM check_ins
            WHERE DATE(timestamp) = DATE('now')
            ORDER BY timestamp DESC
        `;
        
        try {
            const results = await this.dbConnection.all(sql);
            
            logger.debug('Retrieved today\'s check-ins', {
                count: results.length,
                date: new Date().toISOString().split('T')[0]
            });
            
            return results;
        } catch (error) {
            logger.logSystemError('checkin_repository', error, {
                operation: 'getTodaysCheckIns'
            });
            
            throw DatabaseErrorHandler.handleQueryError(error, sql, []);
        }
    }

    /**
     * Get check-in statistics for a date range with error handling
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} - Statistics object
     */
    async getCheckInStats(startDate, endDate) {
        const statusSql = `
            SELECT 
                validation_status,
                COUNT(*) as count
            FROM check_ins
            WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
            GROUP BY validation_status
        `;
        
        const uniqueUsersSql = `
            SELECT COUNT(DISTINCT phone_number) as unique_users
            FROM check_ins
            WHERE DATE(timestamp) BETWEEN DATE(?) AND DATE(?)
        `;
        
        try {
            const params = [startDate.toISOString(), endDate.toISOString()];
            
            const [statusResults, uniqueUsersResult] = await Promise.all([
                this.dbConnection.all(statusSql, params),
                this.dbConnection.get(uniqueUsersSql, params)
            ]);
            
            const stats = {
                total: 0,
                valid: 0,
                expired: 0,
                invalid: 0,
                uniqueUsers: uniqueUsersResult ? uniqueUsersResult.unique_users : 0,
                dateRange: {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                }
            };
            
            statusResults.forEach(row => {
                stats.total += row.count;
                stats[row.validation_status] = row.count;
            });
            
            logger.debug('Generated check-in statistics', {
                ...stats,
                dateRange: `${startDate.toISOString()} to ${endDate.toISOString()}`
            });
            
            return stats;
        } catch (error) {
            logger.logSystemError('checkin_repository', error, {
                operation: 'getCheckInStats',
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });
            
            throw DatabaseErrorHandler.handleQueryError(error, statusSql, [startDate.toISOString(), endDate.toISOString()]);
        }
    }

    /**
     * Delete old check-in records (for cleanup) with error handling
     * @param {number} daysOld - Delete records older than this many days
     * @returns {Promise<number>} - Number of deleted records
     */
    async deleteOldCheckIns(daysOld = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        const sql = `
            DELETE FROM check_ins
            WHERE timestamp < ?
        `;
        
        try {
            const params = [cutoffDate.toISOString()];
            const result = await this.dbConnection.run(sql, params);
            
            logger.info('Deleted old check-in records', {
                daysOld,
                cutoffDate: cutoffDate.toISOString(),
                deletedCount: result.changes,
                duration: result.duration
            });
            
            return result.changes;
        } catch (error) {
            logger.logSystemError('checkin_repository', error, {
                operation: 'deleteOldCheckIns',
                daysOld,
                cutoffDate: cutoffDate.toISOString()
            });
            
            throw DatabaseErrorHandler.handleQueryError(error, sql, [cutoffDate.toISOString()]);
        }
    }

    /**
     * Get repository health status
     * @returns {Promise<Object>}
     */
    async getHealthStatus() {
        try {
            const dbHealth = await this.dbConnection.getHealthStatus();
            
            // Test a simple query
            const testResult = await this.dbConnection.get('SELECT COUNT(*) as count FROM check_ins LIMIT 1');
            
            return {
                status: 'healthy',
                database: dbHealth,
                testQuery: {
                    success: true,
                    recordCount: testResult ? testResult.count : 0
                }
            };
        } catch (error) {
            logger.logSystemError('checkin_repository', error, {
                operation: 'getHealthStatus'
            });
            
            return {
                status: 'unhealthy',
                database: await this.dbConnection.getHealthStatus(),
                testQuery: {
                    success: false,
                    error: error.message
                }
            };
        }
    }
}

export default CheckInRepository;