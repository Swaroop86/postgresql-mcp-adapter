#!/bin/bash

# PostgreSQL MCP Adapter Installation Script

set -e

echo "🚀 Installing PostgreSQL MCP Adapter..."

# Check Node.js version
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ Node.js 18 or higher is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js version check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Make script executable
chmod +x index.js

# Install globally (optional)
read -p "Install globally? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm install -g .
    echo "✅ Installed globally as 'postgresql-mcp'"
fi

# Create environment file
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file from template"
fi

echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your configuration"
echo "2. Start your Spring Boot MCP server"
echo "3. Test connection: npm run test"
echo "4. Configure Cursor IDE (see README.md)"