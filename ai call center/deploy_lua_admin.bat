@echo off
echo Copying Lua script to FreeSWITCH...
copy /y "%~dp0freeswitch_config\scripts\ai_agent_handler.lua" "C:\Program Files\FreeSWITCH\scripts\ai_agent_handler.lua"
if %errorlevel% == 0 (
    echo SUCCESS: Lua script deployed!
) else (
    echo FAILED: Could not copy file. Make sure you ran this as Administrator.
)
pause
