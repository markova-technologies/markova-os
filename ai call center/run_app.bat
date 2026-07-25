@echo off
echo ================================
echo Amharic AI Call System
echo ================================

if exist ".venv\Scripts\activate.bat" (
    echo Activating environment...
    call .venv\Scripts\activate.bat
) else (
    echo Warning: Virtual environment not found!
    echo You may need to run setup_env.bat first.
    echo.
)

echo Starting ngrok in the background on port 8001...
start /b ngrok http 8001 > nul 2>&1
echo Waiting for ngrok to initialize...
timeout /t 3 /nobreak > nul

for /f "tokens=*" %%a in ('curl -s http://localhost:4040/api/tunnels ^| python -c "import sys, json; print(json.load(sys.stdin)['tunnels'][0]['public_url'])" 2^>nul') do set NGROK_URL=%%a
if not "%NGROK_URL%"=="" (
    echo ==================================
    echo Ngrok successfully started!
    echo Public URL: %NGROK_URL%
    echo ==================================
    set BASE_URL=%NGROK_URL%
) else (
    echo Warning: Could not get ngrok URL. Is ngrok installed and in PATH?
    echo FreeSWITCH will use the local address instead.
)

echo Starting Amharic AI Call System...
echo ==================================
echo Server will be available at: http://localhost:8001
echo.
python main_natural_voice.py