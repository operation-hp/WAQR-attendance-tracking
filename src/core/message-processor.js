import { processAIResponse } from './ai-handlers.js';

// Process and send message to AI
export const processMessage = async ({ msg, userId, message, client }) => {
  if (msg && !msg.hasMedia) {
    await processAIResponse({
      messageToSend: message,
      userId,
      client,
    });
  }
};
