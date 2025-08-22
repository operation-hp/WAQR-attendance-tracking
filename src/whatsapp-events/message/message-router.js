/**
 * Message Router
 */
export class MessageRouter {
  constructor(context) {
    this.context = context;
  }

  shouldSkipMessage(msg) {
    const skipTypes = ['protocol', 'notification_template', 'e2e_notification'];
    const skipSubtypes = ['encrypt'];

    return skipTypes.includes(msg.type) || skipSubtypes.includes(msg.subtype);
  }
}
