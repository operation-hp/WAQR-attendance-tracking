/**
 * @param {import('whatsapp-web.js').Client} client
 * @param {Object} messageJson - The message JSON data.
 */
export function readyHandler(client) {
  client.on('ready', async () => {
    console.info('STARTING...');

    const debugWWebVersion = await client.getWWebVersion();
    console.info(`WWebVersion = ${debugWWebVersion}`);

    console.info('READY TO USE!');

    client.pupPage.on('pageerror', function (err) {
      console.info('Page error: ' + err.toString());
    });
    client.pupPage.on('error', function (err) {
      console.info('Page error: ' + err.toString());
    });
  });
}
