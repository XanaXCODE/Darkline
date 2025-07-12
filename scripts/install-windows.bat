@echo off
echo 🌟 Installing Darkline Chat System...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js from https://nodejs.org/
    echo    Download the LTS version and run this script again.
    pause
    exit /b 1
) else (
    echo ✅ Node.js found
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

REM Build the project
echo 🔨 Building project...
npm run build
if %errorlevel% neq 0 (
    echo ❌ Failed to build project
    pause
    exit /b 1
)

REM Make CLI globally available
echo 🔗 Creating global symlink...
npm link
if %errorlevel% neq 0 (
    echo ❌ Failed to create global link. Try running as Administrator.
    pause
    exit /b 1
)

echo ✅ Darkline installed successfully!
echo.
echo 🚀 Quick start:
echo   Start server: darkline create-server
echo   Connect:      darkline connect
echo.
echo 📖 For more info: darkline --help
pause