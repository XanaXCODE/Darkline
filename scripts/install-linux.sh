#!/bin/bash

# Darkline Linux Installation Script

set -e

echo "🌟 Installing Darkline Chat System..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Node.js not found. Installing Node.js..."
    
    # Detect distribution
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ -f /etc/redhat-release ]; then
        # RedHat/CentOS/Fedora
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo dnf install -y nodejs npm
    elif [ -f /etc/arch-release ]; then
        # Arch Linux
        sudo pacman -S nodejs npm
    else
        echo "❌ Unsupported distribution. Please install Node.js manually."
        exit 1
    fi
else
    echo "✅ Node.js found: $(node --version)"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Make binary executable
chmod +x bin/darkline.js

# Make CLI globally available
echo "🔗 Creating global symlink..."
sudo npm link

# Fix permissions after linking
sudo chmod +x /usr/local/lib/node_modules/darkline/bin/darkline.js 2>/dev/null || true

echo "✅ Darkline installed successfully!"
echo ""
echo "🚀 Quick start:"
echo "  Start server: darkline create-server"
echo "  Connect:      darkline connect"
echo ""
echo "📖 For more info: darkline --help"