
/**
 * @param {import('whatsapp-web.js').Client} client - The WhatsApp client instance.
 */
export function loadingScreenHandler(client) {
  client.on('loading_screen', (percent, message) => {
    console.info(`Loading screen: ${percent}% - ${message}`);
  });
}