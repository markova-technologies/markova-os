class ChannelInterface {
  async receiveMessage(channelMsg) {
    throw new Error('Not implemented');
  }

  async sendMessage(internalMsg, channelContext) {
    throw new Error('Not implemented');
  }
}

module.exports = ChannelInterface;
