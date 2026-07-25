const ChannelInterface = require('../interface');

class WebChannelAdapter extends ChannelInterface {
  async receiveMessage(webRequest) {
    return {
      channel: 'web',
      sourceId: webRequest.userId || webRequest.sessionId,
      content: webRequest.text || '',
      context: {
        sessionId: webRequest.sessionId
      }
    };
  }

  async sendMessage(internalMsg, channelContext) {
    // Return standard JSON for web widget
    return {
      type: 'message',
      content: internalMsg.text,
      timestamp: Date.now()
    };
  }
}

module.exports = WebChannelAdapter;
