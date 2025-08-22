export const CHAT_TIME_WAITING = 15 * 1000;
export const FAST_CHAT_TIME_WAITING = 3 * 1000;
export const TYPING_INTERVAL_TIME_MS = 3 * 1000;

// Typing duration constants
export const TYPING_DURATION = {
  SHORT: 3 * 1000, // 3 seconds for quick responses
  NORMAL: 5 * 1000, // 5 seconds for normal processing
  LONG: 10 * 1000, // 10 seconds for media/complex processing
  EXTENDED: 15 * 1000, // 15 seconds for very long operations
};

export const JSON_OBJECT_REGEX = /\{[\s\S]*?\}/g;

export const AUTOGEN_AGENT_TYPE = {
  general: 'general',
  reminder: 'reminder',
  mathProblem: 'math',
  englishQuiz: 'english',
  nonAdmin: 'non-admin',
};

export const CHECKIN_MESSAGE_REGEX =
  /check-in|check-in code|check in|check in code/i;
