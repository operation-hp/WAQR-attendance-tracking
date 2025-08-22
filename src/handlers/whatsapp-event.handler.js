import {
  authHandler,
  loadingScreenHandler,
  messageHandler,
  qrHandler,
  readyHandler,
} from '#src/whatsapp-events/index.js';

export class WhatsappEventHandler {
  constructor(client, options) {
    this.client = client;
    this.userTimeouts = options?.userTimeouts || {}; // Store user timeouts for message processing
  }

  setup() {
    // Setup all event handlers using the modular functions
    loadingScreenHandler(this.client);
    qrHandler(this.client);
    authHandler(this.client);
    readyHandler(this.client);
    messageHandler(this.client, {
      userTimeouts: this.userTimeouts
    });
  }
}
