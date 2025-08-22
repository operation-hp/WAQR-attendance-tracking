
/**
 * @param {import('whatsapp-web.js').Client} client 
 */
export function authHandler(client) {
    client.on('authenticated', async () => {
      console.info('AUTHENTICATED');
    });

    client.on('auth_failure', (msg) => {
      console.error('AUTHENTICATION FAILURE', msg);
    });
  }