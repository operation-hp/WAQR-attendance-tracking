import { TYPING_DURATION } from '#src/const.js';
import { keepTyping } from '#src/helpers/common.js';

/**
 * Typing Management Service
 */
export class TypingManager {
  constructor() {
    this.userTypingCleanup = new Map();
  }

  start(chat, userId, duration = TYPING_DURATION.NORMAL) {
    if (!chat) return;

    this.cleanup(userId);
    const typingCleanup = keepTyping(chat, duration);
    this.userTypingCleanup.set(userId, typingCleanup);
  }

  cleanup(userId) {
    const existingCleanup = this.userTypingCleanup.get(userId);
    if (existingCleanup) {
      existingCleanup();
      this.userTypingCleanup.delete(userId);
    }
  }

  cleanupAll() {
    for (const cleanup of this.userTypingCleanup.values()) {
      cleanup();
    }
    this.userTypingCleanup.clear();
  }
}
