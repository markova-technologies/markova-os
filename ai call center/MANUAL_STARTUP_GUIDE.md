# 🎯 MANUAL STARTUP GUIDE - NATURAL AMHARIC AI CALL SYSTEM

## 🚀 STEP-BY-STEP INSTRUCTIONS

### 📋 **What You'll Do:**
1. Start the AI system manually
2. Test it works
3. Make calls to improve it
4. Ask for enhancements

---

## 🎯 STEP 1: START THE SYSTEM

### 1.1 Open Terminal/Command Prompt
1. Press **Windows Key + R**
2. Type `cmd` and press **Enter**
3. Navigate to your project folder:
```cmd
cd C:\Users\zelal\OneDrive\Documents\Try\amharic-ai-call-demo
```

### 1.2 Start the Natural Voice System
```cmd
python main_natural_voice.py
```

### 1.3 Wait for Startup Message
You should see:
```
🚀 Starting Natural Amharic AI Call System...
INFO: Uvicorn running on http://0.0.0.0:8001
```

✅ **System is now running on port 8001**

> **Note**: You may see a "favicon.ico 200 OK" message in the logs - this is normal and indicates the system is working correctly.

---

## 🧪 STEP 2: TEST THE SYSTEM

### 2.1 Test Health Check
Open a new terminal and run:
```cmd
curl http://localhost:8001/
```
Or in PowerShell:
```powershell
Invoke-WebRequest -Uri http://localhost:8001/ -Method GET
```

You should see system information.

### 2.2 Test Incoming Call
```cmd
curl -X POST http://localhost:8001/incoming-call
```
Or in PowerShell:
```powershell
Invoke-WebRequest -Uri http://localhost:8001/incoming-call -Method POST
```

You should see TwiML response with audio.

✅ **System is working correctly**

---

## 📞 STEP 3: MAKE IT RECEIVE REAL CALLS

### 3.1 Start ngrok (for internet access)
1. Download ngrok from: https://ngrok.com/download
2. Open new terminal
3. Run:
```cmd
ngrok http 8001
```

### 3.2 Get Your Public URL
From ngrok output, find:
```
Forwarding https://abcd1234.ngrok.io -> http://localhost:8001
```

### 3.3 Update Twilio Webhook
1. Go to: https://console.twilio.com
2. Select your phone number
3. Set **Voice webhook** to:
```
https://abcd1234.ngrok.io/incoming-call
```

✅ **System can now receive real phone calls**

---

## 🎯 STEP 4: TEST WITH YOUR PHONE

### 4.1 Call Your Twilio Number
- Dial your Twilio phone number
- Listen to natural Amharic voice
- Speak in Amharic
- Get intelligent responses

### 4.2 Check Server Logs
Look at the terminal running `main_natural_voice.py`:
```
INFO: 📞 Incoming call received
INFO: 🗣️ User input: 'ሰላም'
INFO: ✅ Generated response: ሰላም! ደህና ነዎት? እኔ አልማዝ ነኝ።
```

✅ **Complete call system working**

---

## 🛑 STEP 5: STOP THE SYSTEM

### 5.1 Stop Server
In the terminal running the server:
1. Press **Ctrl + C**
2. Wait for graceful shutdown

### 5.2 Stop ngrok (if running)
In the ngrok terminal:
1. Press **Ctrl + C**

✅ **System properly stopped**

---

## 🔧 TROUBLESHOOTING

### ❌ Problem: "Port already in use"
```cmd
netstat -ano | findstr :8001
taskkill /f /im python.exe
```

### ❌ Problem: "Module not found"
```cmd
pip install -r requirements.txt
```

### ❌ Problem: "Audio not working"
Check the `audio/` folder for generated files.

---

## 🎯 READY TO ASK FOR IMPROVEMENTS

Once your system is running, you can:
1. **Test it thoroughly**
2. **Identify what you want to improve**
3. **Ask me for specific enhancements**

### Examples of improvements you can request:
- "Make the voice sound more natural"
- "Add more Amharic phrases"
- "Improve conversation flow"
- "Add call recording"
- "Make it faster"

---

## 📋 QUICK REFERENCE

### Start System:
```cmd
python main_natural_voice.py
```

### Start ngrok:
```cmd
ngrok http 8001
```

### Test Health:
```cmd
curl http://localhost:8001/
```

### Test Call:
```cmd
curl -X POST http://localhost:8001/incoming-call
```

### Stop System:
```
Ctrl + C
```

---

## 🎯 YOU'RE READY!

Your natural Amharic AI call system is designed to be:
- ✅ Easy to start manually
- ✅ Reliable for testing
- ✅ Ready for improvements
- ✅ Production quality

Start it whenever you want, test it, and ask me to make it better! 🇪🇹✨
```

```
# Manual Startup Guide for Amharic AI Call System

This guide provides step-by-step instructions for manually starting the Amharic AI Call System.

## Prerequisites

1. Python 3.8 or higher installed
2. Ngrok account and ngrok CLI installed
3. Twilio account with phone number configured
4. Groq API key
5. All dependencies installed via `pip install -r requirements.txt`

## Step 1: Set up Environment Variables

Create a `.env` file in the project root with the following variables:

```env
GROQ_API_KEY=your_groq_api_key_here
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
BASE_URL=https://your-ngrok-url.ngrok.io
```

## Step 2: Start the FastAPI Server

In a terminal, navigate to the project directory and run:

```bash
uvicorn main_natural_voice:app --host 0.0.0.0 --port 8001 --reload
```

The server will start on `http://localhost:8001`

## Step 3: Expose the Server with Ngrok

In a new terminal window, run:

```bash
ngrok http 8001
```

This will provide a public URL that looks like `https://abcd1234.ngrok.io`

## Step 4: Update Environment Variables

Copy the ngrok URL and update your `.env` file:

```env
BASE_URL=https://abcd1234.ngrok.io
```

## Step 5: Configure Twilio Webhook

1. Go to your Twilio Console
2. Navigate to your phone number settings
3. Set the Voice webhook URL to:
   ```
   https://abcd1234.ngrok.io/incoming-call
   ```
4. Set the webhook HTTP method to POST

## Step 6: Test the System

1. Call your Twilio phone number
2. You should hear a natural Amharic voice greeting
3. Speak in Amharic and the AI should respond appropriately

## Troubleshooting

- If you don't hear any audio, check the ngrok tunnel is active
- If the AI doesn't respond, verify your Groq API key is correct
- If there are connection issues, ensure your firewall allows the connections

## Stopping the System

1. Press `Ctrl+C` in the uvicorn terminal to stop the server
2. Press `Ctrl+C` in the ngrok terminal to stop the tunnel
