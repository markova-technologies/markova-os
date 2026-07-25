const ChannelInterface = require('../interface');

class VoiceChannelAdapter extends ChannelInterface {
  async receiveMessage(twilioRequest) {
    return {
      channel: 'voice',
      sourceId: twilioRequest.From,
      content: twilioRequest.SpeechResult || '',
      context: {
        callSid: twilioRequest.CallSid,
        to: twilioRequest.To
      }
    };
  }

  async sendMessage(internalMsg, channelContext) {
    // Generate TwiML response
    if (internalMsg.audioUrl) {
      return `<Response><Play>${internalMsg.audioUrl}</Play></Response>`;
    } else {
      return `<Response><Say>${internalMsg.text}</Say></Response>`;
    }
  }
}

module.exports = VoiceChannelAdapter;
