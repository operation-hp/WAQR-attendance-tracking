import 'dotenv/config';

import { whatsappClient } from '#src/configs/whatsapp-client.js';
import { WhatsappEventHandler } from '#src/handlers/whatsapp-event.handler.js';
import { ExpressServer } from '#src/servers/express.server.js';

class App {
  constructor() {
    // Initialize WhatsApp client
    this.client = whatsappClient.getClient();
    this.expressServer = new ExpressServer(this.client);
    this.WAEventHandler = new WhatsappEventHandler(this.client);
    this.userTimeouts = {}; // Store user timeouts for message processing
  }

  initialize() {
    // Initialize Express server
    this.expressServer.start();
    this.WAEventHandler.setup(this.client, {
      userTimeouts: this.userTimeouts,
    });

    // Initialize client
    this.client.initialize();

    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

      // Destroy WhatsApp client
      if (this.client) {
        this.client.destroy();
      }

      console.log('Graceful shutdown completed');
      process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  }

  getClient() {
    return this.client;
  }
}

// Create and initialize the app
const app = new App();
app.initialize();

// Export client for other modules that might need it
export const client = app.getClient();
export default app;
