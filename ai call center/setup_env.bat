@echo off
echo ========================================
echo Amharic AI Call System Environment Setup
echo ========================================
echo This script will create a virtual environment and install all required packages.
echo Please make sure you have Python 3.8 or higher installed.
echo.
pause

echo Creating virtual environment and installing packages...
python setup_environment.py

if %errorlevel% == 0 (
    echo.
    echo Setup completed successfully!
    echo.
    echo To activate the environment, run: activate.bat
    echo To start the application, run: python main_natural_voice.py
) else (
    echo.
    echo Setup failed. Please check the error messages above.
)

echo.
pause