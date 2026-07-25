@echo off
echo Starting National Scale Amharic AI Call Center...
echo ------------------------------------------------
echo Mode: PRODUCTION (Multi-Worker)
echo Workers: 4 (Optimized for this machine)
echo ------------------------------------------------

:: Ensure dependencies are installed
pip install uvicorn httpx aiosqlite structlog groq openai python-dotenv fastapi

:: Run Uvicorn with 4 workers for parallelism
:: --workers 4: Creates 4 separate processes to handle calls
:: --loop asyncio: Use standard asyncio loop compatible with httpx
uvicorn main_natural_voice:app --host 0.0.0.0 --port 8001 --workers 4 --loop asyncio
