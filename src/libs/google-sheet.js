
import ConversationSheetStorage from './attendance/storage/ConversationSheetStorage.js';

import { envConfig } from '#src/configs/environment.js';

export const conversationSheetStorage = new ConversationSheetStorage();

class GoogleSheetHandling {
  constructor() {
    this.apiKey = envConfig.APPS_SCRIPT_API_KEY;
    this.webAppUrl = envConfig.APPS_SCRIPT_WEB_APP_URL;
  }

  async _postData(data) {
    try {
      const response = await fetch(`${this.webAppUrl}?token=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error posting data to Google Sheet:', error);
      throw error;
    }
  }

  async getHeader({
    sheetName,
    spreadsheetId,
    headerRange = '1:1',
    asDisplay = true,
    trimTrailingEmpty = true,
  }) {
    try {
      const response = await this._postData({
        action: 'getHeader',
        spreadsheetId,
        sheetName,
        headerRange,
        asDisplay,
        trimTrailingEmpty,
      });

      if (response.ok) {
        return response.result.header;
      }
      throw new Error(
        `Error getting header from Google Sheet: ${response.error}`,
      );
    } catch (error) {
      console.error('Error getting header from Google Sheet:', error);
      throw error;
    }
  }

  async updateHeader({
    sheetName,
    spreadsheetId,
    headerRange = '1:1',
    clearExtra = true,
    updatedHeader,
  }) {
    try {
      await this._postData({
        action: 'updateHeader',
        spreadsheetId,
        sheetName,
        headerRange,
        updatedHeader,
        clearExtra,
      });
    } catch (error) {
      console.error('Error updating header in Google Sheet:', error);
      throw error;
    }
  }

  async appendValues({ sheetName, spreadsheetId, startRange, values }) {
    try {
      await this._postData({
        action: 'append',
        spreadsheetId,
        sheetName,
        startRange,
        values,
      });
    } catch (error) {
      console.error('Error appending values to Google Sheet:', error);
      throw error;
    }
  }
}

export const googleSheetHandling = new GoogleSheetHandling();
