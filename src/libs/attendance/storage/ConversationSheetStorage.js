import AttendanceStorage from './AttendanceStorage.js';

import { envConfig } from '#src/configs/environment.js';
import { googleSheetHandling } from '#src/libs/google-sheet.js';
import { extractUserId, formatUserIdWA } from '#src/utils/common.js';

class ConversationSheetStorage extends AttendanceStorage {
  constructor() {
    super();
  }

  /**
   * @param {string} sheetId
   * @param {Object} payload
   * @param {string} payload.time
   * @param {Object.<string, {message: {
   * type: string;
   * content: string;
   * mediaUrl?: string;
   * }}[]>} payload.conversations
   * @param {string} [payload.sheetName='Sheet1']
   * @param {string} [payload.startPoint='A3']
   */
  async update(sheetId, options) {
    const {
      time,
      conversations,
      sheetName = 'Sheet1',
      startPoint = 'A3',
    } = options;

    try {
      const headerRow = await googleSheetHandling.getHeader({
        spreadsheetId: sheetId,
        sheetName,
        headerRange: '1:1',
      });

      const employeeNameRow = await googleSheetHandling.getHeader({
        spreadsheetId: sheetId,
        sheetName,
        headerRange: '2:2',
      });

      const existingUids = new Set(headerRow);

      const newUids = Object.keys(conversations)
        .map((uid) => extractUserId(uid, '@c.us'))
        .filter((uid) => {
          return !existingUids.has(uid);
        });

      if (newUids.length > 0) {
        const updatedHeader = [...headerRow, ...newUids];
        await googleSheetHandling.updateHeader({
          spreadsheetId: sheetId,
          sheetName,
          headerRange: '1:1',
          updatedHeader,
        });
      }

      const finalHeader = await googleSheetHandling.getHeader({
        sheetName,
        headerRange: '1:1',
        spreadsheetId: sheetId,
      });

      const finalUids = finalHeader.slice(1);

      const nameRowFormulas = finalHeader.map((_, colIndex) => {
        if (colIndex === 0) {
          const firstRow = employeeNameRow[colIndex] || 'Employee Name';
          return firstRow;
        }
        const colLetter = String.fromCharCode(65 + colIndex);
        return `=IFNA(VLOOKUP(${colLetter}1,${envConfig.DEFAULT_SHEET.NAME_LIST}!A:B,2,FALSE), ${colLetter}1)`;
      });

      await googleSheetHandling.updateHeader({
        spreadsheetId: sheetId,
        sheetName,
        headerRange: '2:2',
        updatedHeader: nameRowFormulas,
      });

      const row = [time];
      const imageRow = [time];
      for (const uid of finalUids) {
        const assistantRegex = /assistant|agent|assistant agent/i;
        const messages =
          conversations[assistantRegex.test(uid) ? uid : formatUserIdWA(uid)] ??
          [];

        const messageContent = messages
          .map((m) => {
            if (typeof m.message === 'string') {
              return m.message;
            }

            if (!m.message || !m.message.type) {
              return null;
            }

            if (m.message.type === 'image' && m.message.mediaUrl) {
              imageRow.push(`=IMAGE("${m.message.mediaUrl}")`);
            }

            return m.message.content;
          })
          .filter(Boolean);

        row.push(messageContent.join('\n'));
      }

      const values = [row, imageRow].filter((r) => r.length > 1);

      if (values.length > 0) {
        await googleSheetHandling.appendValues({
          spreadsheetId: sheetId,
          sheetName,
          startRange: startPoint,
          values,
        });
      }

      console.info(`✅ Data written to sheet at time ${time}`);
    } catch (error) {
      console.error('Error updating conversation sheet:', error);
      throw error;
    }
  }
}

export default ConversationSheetStorage;
