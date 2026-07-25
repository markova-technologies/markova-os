# Twilio Configuration Guide for Enhanced Amharic AI Call Center

## Setting Up Your Twilio Phone Number

1. Log in to your Twilio account at [twilio.com/console](https://twilio.com/console)
2. Navigate to Phone Numbers > Manage > Active Numbers
3. Select the phone number you want to use or purchase a new one
4. Under "Voice & Fax" configuration:
   - Set "A Call Comes In" to "Webhook"
   - Enter your ngrok URL + "/incoming-call" in the webhook field (e.g., `https://your-ngrok-url.ngrok-free.app/incoming-call`)
   - Set the HTTP method to POST

## Enhanced TwiML for Full Amharic Experience

The system now includes:
- **Whisper-powered speech recognition** for accurate Amharic transcription
- **Groq LLM** for natural Amharic conversation
- **Professional call flow** with proper greetings and error handling

### Primary Endpoint: `/incoming-call`
This is the main entry point for incoming calls. It:
1. Greets callers in Amharic
2. Records their speech
3. Processes with Whisper + Groq
4. Responds naturally in Amharic
5. Allows for continued conversation

### Backup Endpoint: `/handle-speech` 
For testing and backward compatibility with simple text input.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="am-ET">እንኳን ደህና መጡ። እባክዎ ጥያቄዎን ይናገሩ።</Say>
  <Gather input="speech" action="/handle-speech" method="POST" language="am-ET" speechTimeout="auto">
    <Say language="am-ET">ምን ልርዳዎት?</Say>
  </Gather>
  <Say language="am-ET">ምንም ምላሽ አልተቀበልኩም። ስለተጠቀሙት እናመሰግናለን።</Say>
</Response>
```

This TwiML:
1. Greets the caller in Amharic
2. Asks how it can help
3. Listens for speech input in Amharic
4. Sends the transcribed speech to your webhook
5. If no input is received, it thanks the caller and ends the call

## Testing Your Configuration

1. Make sure your server is running locally
2. Start ngrok with `ngrok http 8000`
3. Configure your Twilio phone number with the ngrok URL
4. Call your Twilio phone number
5. Speak in Amharic or English (the system will respond in Amharic)

## Troubleshooting

- If calls aren't connecting to your webhook, check that ngrok is running and your Twilio webhook URL is correct
- If you're not getting responses, check your server logs for errors
- Make sure your OpenAI API key is valid in the .env file
- Verify that your Twilio account has sufficient credits for voice calls