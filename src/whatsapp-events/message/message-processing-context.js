import { TypingManager } from './typing-manager.js';

import { CHAT_TIME_WAITING } from '#src/const.js';

/**
 * Message Processing Context
 */
export class MessageProcessingContext {
  constructor(client, options) {
    this.client = client;
    this.userTimeouts = options.userTimeouts;

    this.typingManager = new TypingManager();
    this.processingCompleted = false;
  }

  handleProcessComplete(userId) {
    this.clearUserTimeout(userId);
    this.typingManager.cleanup(userId);
  }

  clearUserTimeout(userId) {
    const timeoutId = this.userTimeouts[userId];
    if (timeoutId) {
      clearTimeout(timeoutId);
      delete this.userTimeouts[userId];
    }
  }

  setupWaitingTimeout(userId) {
    this.clearUserTimeout(userId);

    const timeoutId = setTimeout(() => {
      if (!this.processingCompleted) {
        this.client.sendMessage(userId, 'Please wait...');
      }
      delete this.userTimeouts[userId];
    }, CHAT_TIME_WAITING);

    this.userTimeouts[userId] = timeoutId;
  }
}
