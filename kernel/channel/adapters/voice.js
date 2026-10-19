const ChannelInterface = require('../interface');

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

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
      return `<Response><Play>${escapeXml(internalMsg.audioUrl)}</Play></Response>`;
    } else {
      return `<Response><Say>${escapeXml(internalMsg.text)}</Say></Response>`;
    }
  }
}

module.exports = VoiceChannelAdapter;
