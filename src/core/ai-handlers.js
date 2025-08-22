import { DateTime } from 'luxon';
import pkg from 'whatsapp-web.js';

import { envConfig } from '#src/configs/environment.js';
import { CHECKIN_MESSAGE_REGEX } from '#src/const.js';
import { conversationSheetStorage } from '#src/libs/google-sheet.js';
import { extractUserId } from '#src/utils/common.js';

const { MessageTypes } = pkg;

// Process AI response and handle autogen
export const processAIResponse = async ({ messageToSend, userId, client }) => {
  try {
    const isCheckinMessage = CHECKIN_MESSAGE_REGEX.test(messageToSend);

    if (isCheckinMessage) {
      const [, code] = messageToSend.split(':') ?? [
        'Check-in code',
        'Invalid Code',
      ];

      const qrCode = code.trim();
      const now = DateTime.now().setZone(envConfig.TIME_ZONE);

      const response = await fetch(envConfig.ATTENDANCE_API_URL + '/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: extractUserId(userId, '@c.us'),
          otp: qrCode,
          time: now.toISO(),
        }),
      });

      const checkinResponse = await response.json();

      if (checkinResponse.success) {
        await conversationSheetStorage.update(envConfig.DEFAULT_SHEET.ID, {
          time: now.toFormat('MM/dd/yyyy HH:mm:ss'),
          conversations: {
            [userId]: [
              {
                message: {
                  content: messageToSend,
                  type: MessageTypes.TEXT,
                },
              },
            ],
          },
          sheetName: envConfig.DEFAULT_SHEET.TRACKING,
          startPoint: 'A3',
        });
      }

      const checkinResponseMsg = checkinResponse.success
        ? 'You have successfully checked in. Thank you!'
        : `${checkinResponse.error.message}. Please try scanning again!`;

      return client.sendMessage(userId, checkinResponseMsg);
    }

    client.sendMessage(
      userId,
      `Please scan the QR code at: ${envConfig.ATTENDANCE_QR_CODE_URL}`,
    );
  } catch (err) {
    console.error('Error in processAIResponse: ', err);
  }
};
