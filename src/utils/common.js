export const formatUserIdWA = (number) => {
  const formattedNumber = number.trim();
  return formattedNumber.endsWith('@c.us')
    ? formattedNumber
    : `${formattedNumber}@c.us`;
};

/**
 * Splits a user ID into its components.
 * @param {string} userId - The user ID to split (e.g., "123456789@c.us")
 * @param {string} waSuffix - The suffix used to split the user ID in Whatsapp (@c.us or @g.us)
 * @returns {string} An object containing id, type, and token properties
 */
export const extractUserId = (userId, waSuffix) => {
  const [user] = userId.includes(waSuffix) ? userId.split(waSuffix) : [userId];
  return user;
};
