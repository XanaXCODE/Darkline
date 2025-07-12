#!/bin/bash

# Linux Binary Build Script for Darkline

set -e

echo "🔨 Building Darkline Linux Binary..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the darkline root directory"
    exit 1
fi

# Install dependencies if not already installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🏗️  Building project..."
npm run build

# Install pkg if not installed
if ! command -v pkg &> /dev/null; then
    echo "📦 Installing pkg..."
    npm install -g pkg
fi

# Create standalone binary
echo "📦 Creating standalone binary..."
pkg . --targets node18-linux-x64 --output darkline-linux

# Make binary executable
chmod +x darkline-linux

# Create installation script
cat > install-darkline.sh << 'EOF'
#!/bin/bash

# Darkline Linux Installation Script

set -e

echo "🌟 Installing Darkline..."

# Check if running as root for system-wide installation
if [ "$EUID" -eq 0 ]; then
    INSTALL_DIR="/usr/local/bin"
    echo "Installing system-wide to $INSTALL_DIR"
else
    INSTALL_DIR="$HOME/.local/bin"
    echo "Installing to user directory $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
fi

# Copy binary
cp darkline-linux "$INSTALL_DIR/darkline"
chmod +x "$INSTALL_DIR/darkline"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo "Adding $INSTALL_DIR to PATH..."
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> ~/.bashrc
    echo "Please run 'source ~/.bashrc' or restart your terminal"
fi

echo "✅ Darkline installed successfully!"
echo "Run 'darkline --help' to get started"
EOF

chmod +x install-darkline.sh

# Create AppImage (if appimage-builder is available)
if command -v appimage-builder &> /dev/null; then
    echo "🎁 Creating AppImage..."
    
    # Create AppImage directory structure
    mkdir -p darkline.AppDir/usr/bin
    mkdir -p darkline.AppDir/usr/share/applications
    mkdir -p darkline.AppDir/usr/share/icons/hicolor/256x256/apps
    
    # Copy binary
    cp darkline-linux darkline.AppDir/usr/bin/darkline
    
    # Create desktop file
    cat > darkline.AppDir/usr/share/applications/darkline.desktop << 'EOF'
[Desktop Entry]
Name=Darkline
Comment=Secure Decentralized Chat System
Exec=darkline
Icon=darkline
Terminal=true
Type=Application
Categories=Network;InstantMessaging;
EOF
    
    # Create AppRun
    cat > darkline.AppDir/AppRun << 'EOF'
#!/bin/bash
exec "$APPDIR/usr/bin/darkline" "$@"
EOF
    chmod +x darkline.AppDir/AppRun
    
    # Build AppImage
    appimage-builder --recipe AppImageBuilder.yml
else
    echo "⚠️  appimage-builder not found. Skipping AppImage creation."
fi

echo "✅ Linux build completed!"
echo "Files created:"
echo "  - darkline-linux (standalone binary)"
echo "  - install-darkline.sh (installation script)"
if [ -f "Darkline-*.AppImage" ]; then
    echo "  - Darkline-*.AppImage (portable app)"
fi