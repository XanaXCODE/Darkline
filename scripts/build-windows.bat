@echo off
echo 🔨 Building Darkline Windows Installer...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Please run this script from the darkline root directory
    exit /b 1
)

REM Install dependencies if not already installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
)

REM Build the project
echo 🏗️  Building project...
npm run build

REM Install electron-builder if not installed
npm list electron-builder >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing electron-builder...
    npm install --save-dev electron-builder
)

REM Create electron app structure
if not exist "electron" mkdir electron

REM Create electron main.js
echo const { app, BrowserWindow, shell } = require('electron'); > electron\main.js
echo const path = require('path'); >> electron\main.js
echo const { spawn } = require('child_process'); >> electron\main.js
echo. >> electron\main.js
echo let mainWindow; >> electron\main.js
echo let serverProcess; >> electron\main.js
echo. >> electron\main.js
echo function createWindow() { >> electron\main.js
echo   mainWindow = new BrowserWindow({ >> electron\main.js
echo     width: 1200, >> electron\main.js
echo     height: 800, >> electron\main.js
echo     webPreferences: { >> electron\main.js
echo       nodeIntegration: true, >> electron\main.js
echo       contextIsolation: false >> electron\main.js
echo     } >> electron\main.js
echo   }); >> electron\main.js
echo   mainWindow.loadFile('electron/index.html'); >> electron\main.js
echo } >> electron\main.js
echo. >> electron\main.js
echo app.whenReady().then(createWindow); >> electron\main.js

REM Create electron HTML
echo ^<!DOCTYPE html^> > electron\index.html
echo ^<html^> >> electron\index.html
echo ^<head^> >> electron\index.html
echo   ^<title^>Darkline^</title^> >> electron\index.html
echo   ^<style^> >> electron\index.html
echo     body { font-family: Arial, sans-serif; margin: 20px; background: #1a1a1a; color: white; } >> electron\index.html
echo     button { padding: 10px 20px; margin: 10px; background: #007AFF; color: white; border: none; border-radius: 5px; cursor: pointer; } >> electron\index.html
echo   ^</style^> >> electron\index.html
echo ^</head^> >> electron\index.html
echo ^<body^> >> electron\index.html
echo   ^<h1^>Darkline Desktop^</h1^> >> electron\index.html
echo   ^<p^>Secure Decentralized Chat System^</p^> >> electron\index.html
echo   ^<button onclick="startServer()"^>Start Server^</button^> >> electron\index.html
echo   ^<button onclick="connectToServer()"^>Connect to Server^</button^> >> electron\index.html
echo   ^<script^> >> electron\index.html
echo     const { shell } = require('electron'); >> electron\index.html
echo     function startServer() { >> electron\index.html
echo       shell.openExternal('http://localhost:3000'); >> electron\index.html
echo     } >> electron\index.html
echo     function connectToServer() { >> electron\index.html
echo       shell.openExternal('http://localhost:3000/connect'); >> electron\index.html
echo     } >> electron\index.html
echo   ^</script^> >> electron\index.html
echo ^</body^> >> electron\index.html
echo ^</html^> >> electron\index.html

REM Update package.json for electron
echo 📝 Updating package.json for Electron...
npm pkg set main="electron/main.js"
npm pkg set homepage="."
npm pkg set scripts.electron="electron ."
npm pkg set scripts.electron-build="electron-builder"

REM Build installer
echo 🎁 Creating Windows installer...
npm run electron-build -- --win

echo ✅ Windows installer created in dist/ folder!