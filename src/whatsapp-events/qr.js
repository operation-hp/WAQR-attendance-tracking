import qrCode from 'qrcode-terminal';

import { envConfig } from '#src/configs/environment.js';

const PHONE_NUMBER = envConfig.PHONE_NUMBER;

/**
 * @param {import('whatsapp-web.js').Client} client
 */
export function qrHandler(client) {
  let pairingCodeRequested = false;

  client.on('qr', async (qr) => {
    console.info('QR RECEIVED');
    qrCode.generate(qr, { small: true });

    const pairingCodeEnabled = true;
    if (pairingCodeEnabled && !pairingCodeRequested) {
      if (!PHONE_NUMBER) {
        console.error('PHONE_NUMBER is not defined');
        return;
      }

      try {
        console.info('Requesting pairing code for:', PHONE_NUMBER);
        const pairingCode = await client.requestPairingCode(PHONE_NUMBER);
        console.info('Pairing code enabled, code: ' + pairingCode);
        pairingCodeRequested = true;
      } catch (error) {
        console.error('Error requesting pairing code:', error);
        console.info('Falling back to QR code method');
      }
    }
  });
}
