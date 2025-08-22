import { MessageProcessingContext } from './message-processing-context.js';
import { MessageRouter } from './message-router.js';

import { TYPING_DURATION } from '#src/const.js';
import { processMessage } from '#src/core/message-processor.js';

/**
 * Main message handler function
 */
export function messageHandler(client, options) {
  const context = new MessageProcessingContext(client, options);
  const router = new MessageRouter(context);

  const logMessage = (msg) => {
    console.info('MESSAGE RECEIVED', {
      body: msg.body,
      type: msg.type,
      from: msg.from,
      to: msg.to,
      id: msg.id,
      ...(msg.author && { author: msg.author }),
    });
  };

  const handleEarlyReturns = async (msg, userId) => {
    if (router.shouldSkipMessage(msg)) {
      context.handleProcessComplete(userId);
      return true;
    }

    return false;
  };

  const setupTypingAndTimeout = (userId, chat, shouldSetup) => {
    if (shouldSetup) {
      console.info(`Start typing indicator for ${userId}`);
      context.typingManager.start(chat, userId, TYPING_DURATION.EXTENDED);
      context.setupWaitingTimeout(userId);
    }
  };

  client.on('message', async (msg) => {
    try {
      logMessage(msg);

      const userId = msg.from;

      if (await handleEarlyReturns(msg, userId)) return;

      const chat = await msg.getChat();
      if (!chat) {
        console.error('Chat not found for message:', msg);
        await client.sendMessage(
          userId,
          'Chat not found. Please try again later.',
        );
        return;
      }

      const isPersonalChat = msg.from.includes('@c.us');

      setupTypingAndTimeout(userId, chat, isPersonalChat);

      try {
        await processMessage({
          msg,
          userId,
          message: msg.body,
          client,
        });
      } catch (error) {
        console.error('Error in message handler:', error);
        await client.sendMessage(userId, 'Please wait a minute and try again.');
      } finally {
        context.handleProcessComplete(userId);
        if (chat?.clearState) {
          try {
            await chat.clearState();
          } catch (clearError) {
            console.error('Error clearing chat state:', clearError);
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
}
