import pkg from 'whatsapp-web.js';

const { Client, LocalAuth } = pkg;

// WhatsApp client class
export class WhatsAppClient {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        }),
        args: [
          '--disable-accelerated-2d-canvas',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-cache',
          '--disable-component-extensions-with-background-pages',
          '--disable-crash-reporter',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-gpu',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-mojo-local-storage',
          '--disable-notifications',
          '--disable-popup-blocking',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-renderer-backgrounding',
          '--disable-software-rasterizer',
          '--ignore-certificate-errors',
          '--log-level=3',
          '--no-default-browser-check',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
          '--disable-setuid-sandbox',
          '--disable-features=VizDisplayCompositor',
          '--renderer-process-limit=1',
        ],
        headless: true,
      },
    });
  }

  getClient() {
    return this.client;
  }
}

export const whatsappClient = new WhatsAppClient();
