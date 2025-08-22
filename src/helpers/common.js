import { TYPING_INTERVAL_TIME_MS } from '#src/const.js';

export const keepTyping = (chat, duration = 5000) => {
  const intervalTime = TYPING_INTERVAL_TIME_MS;
  const endTime = Date.now() + duration;
  let typingInterval;

  const startTyping = () => {
    typingInterval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(typingInterval);
        return;
      }

      if (!chat || !chat.sendStateTyping) {
        console.error('Chat or sendStateTyping method is not available:', chat);
        clearInterval(typingInterval);
        return;
      }

      try {
        // Send typing state to the chat
        await chat.sendStateTyping();
      } catch (error) {
        console.error('Error sending typing state:', error);
        clearInterval(typingInterval);
      }
    }, intervalTime);
  };

  // Start typing immediately and then continue with interval
  if (chat && chat.sendStateTyping) {
    chat.sendStateTyping().catch((error) => {
      console.error('Error sending initial typing state:', error);
    });
  }

  startTyping();

  // Return cleanup function
  return () => {
    if (typingInterval) {
      clearInterval(typingInterval);
    }
  };
};
