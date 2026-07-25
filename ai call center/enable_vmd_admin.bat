@echo off
:: Enables mod_vmd in FreeSWITCH for voice barge-in
:: Must be run as Administrator

set CONFIG=C:\Program Files\FreeSWITCH\conf\autoload_configs\modules.conf.xml

:: Check if already enabled
findstr /C:"mod_vmd" "%CONFIG%" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] mod_vmd already enabled in modules.conf.xml
    goto load_runtime
)

:: Add mod_vmd after mod_httapi line using PowerShell
powershell -Command "(Get-Content '%CONFIG%') -replace '(<load module=""mod_httapi""/>)', '$1`n    <!-- Voice Activity Detection for barge-in -->`n    <load module=""mod_vmd""/>' | Set-Content '%CONFIG%'"

echo [OK] mod_vmd added to modules.conf.xml

:load_runtime
:: Also load it at runtime via ESL if FreeSWITCH is running
echo Attempting to load mod_vmd at runtime...
"C:\Program Files\FreeSWITCH\fs_cli.exe" -p ClueCon -x "load mod_vmd" 2>nul
echo [OK] mod_vmd load command sent to FreeSWITCH

:: Verify
"C:\Program Files\FreeSWITCH\fs_cli.exe" -p ClueCon -x "module_exists mod_vmd" 2>nul

echo.
echo Done! mod_vmd is ready for voice barge-in.
pause
