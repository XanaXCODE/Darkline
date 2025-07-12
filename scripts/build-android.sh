#!/bin/bash

# Android APK Build Script for Darkline

set -e

echo "🔨 Building Darkline Android APK..."

# Check if we're in the right directory
if [ ! -f "mobile/package.json" ]; then
    echo "❌ Please run this script from the darkline root directory"
    exit 1
fi

# Navigate to mobile directory
cd mobile

# Check if Expo CLI is installed
if ! command -v expo &> /dev/null; then
    echo "📦 Installing Expo CLI..."
    npm install -g @expo/cli
fi

# Install dependencies
echo "📦 Installing mobile dependencies..."
npm install

# Check if EAS CLI is installed for building
if ! command -v eas &> /dev/null; then
    echo "📦 Installing EAS CLI..."
    npm install -g @expo/eas-cli
fi

echo "🏗️  Building APK..."
echo "Note: This requires an Expo account. Please log in when prompted."

# Build APK
eas build --platform android --profile preview

echo "✅ Android build completed!"
echo "The APK will be available in your Expo dashboard."
echo "You can also build locally with: expo build:android"