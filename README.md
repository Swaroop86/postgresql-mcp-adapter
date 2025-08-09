# CodeForge MCP Adapter 🔌

<div align="center">

[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-0.5.0-blue)](https://modelcontextprotocol.org)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Cursor](https://img.shields.io/badge/Cursor-Compatible-purple)](https://cursor.sh)
[![VS Code](https://img.shields.io/badge/VS%20Code-Compatible-blue)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**Bridge your AI-powered IDE to the CodeForge ecosystem**

[Quick Start](#-quick-start) • [IDE Setup](#-ide-configuration) • [Troubleshooting](#-troubleshooting) • [Development](#-development)

</div>

---

## 🎯 What is CodeForge MCP Adapter?

The CodeForge MCP Adapter is your local bridge that connects AI-powered IDEs (like Cursor, VS Code with Copilot, or any MCP-compatible editor) to the CodeForge MCP Server. It translates natural language requests from your IDE into structured commands, enabling seamless AI-driven code generation directly in your development environment.

### 🌟 Key Features

- **🔗 Universal IDE Compatibility**: Works with any MCP-compatible IDE
- **🚀 Zero-Config Setup**: Auto-detects project structure and context
- **📁 Smart File Management**: Automatically applies generated code to the right locations
- **💾 Intelligent Backup System**: Creates backups before modifying files
- **🔄 Real-time Sync**: Instant updates as you type
- **🎯 Context Awareness**: Understands your project structure
- **📊 Progress Tracking**: Visual feedback during generation
- **🔐 Secure Communication**: Encrypted connection to CodeForge server

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your IDE (Cursor/VS Code)                 │
│                         AI Assistant                         │
└────────────────────┬────────────────────────────────────────┘
                     │ stdio/pipes
┌────────────────────▼────────────────────────────────────────┐
│                  CodeForge MCP Adapter                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • Project Context Analyzer                            │ │
│  │  • Request Translator                                  │ │
│  │  • File Manager                                        │ │
│  │  • Backup System                                       │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────────┐
│          CodeForge MCP Server (Cloud/Self-Hosted)           │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** (required)
- **Git** (for cloning the repository)
- **Your IDE** with MCP support (Cursor, VS Code, etc.)

### Installation

#### Option 1: Quick Install Script (Recommended)

Save this script as `install-codeforge-adapter.sh` (macOS/Linux) or `install-codeforge-adapter.ps1` (Windows):

**macOS/Linux** (`install-codeforge-adapter.sh`):
```bash
#!/bin/bash

# CodeForge MCP Adapter Installation Script

set -e

echo "🚀 Installing CodeForge MCP Adapter..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

# Set installation directory
INSTALL_DIR="$HOME/.codeforge/mcp-adapter"

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    echo "📦 Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "📦 Cloning CodeForge MCP Adapter..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone https://github.com/codeforge/mcp-adapter.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create global command link
echo "🔗 Creating global command..."
npm link

# Create convenience script
cat > /usr/local/bin/codeforge-mcp << 'EOF'
#!/bin/bash
node "$HOME/.codeforge/mcp-adapter/index.js" "$@"
EOF
chmod +x /usr/local/bin/codeforge-mcp

# Set up environment
echo "⚙️  Setting up environment..."
cp .env.example .env 2>/dev/null || true

# Configure default server
sed -i '' 's|MCP_SERVER_URL=.*|MCP_SERVER_URL=https://api.codeforge.dev/mcp|g' .env 2>/dev/null || \
sed -i 's|MCP_SERVER_URL=.*|MCP_SERVER_URL=https://api.codeforge.dev/mcp|g' .env

echo "✅ CodeForge MCP Adapter installed successfully!"
echo ""
echo "📝 Installation location: $INSTALL_DIR"
echo "🔧 Configuration file: $INSTALL_DIR/.env"
echo ""
echo "Next steps:"
echo "1. Configure your IDE (see instructions below)"
echo "2. Run 'codeforge-mcp test' to verify installation"
echo "3. Start using CodeForge in your IDE!"
```

**Windows** (`install-codeforge-adapter.ps1`):
```powershell
# CodeForge MCP Adapter Installation Script for Windows

Write-Host "🚀 Installing CodeForge MCP Adapter..." -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node -v
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Host "❌ Node.js 18+ required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    Write-Host "   Visit: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Set installation directory
$installDir = "$env:USERPROFILE\.codeforge\mcp-adapter"

# Clone or update repository
if (Test-Path $installDir) {
    Write-Host "📦 Updating existing installation..." -ForegroundColor Green
    Set-Location $installDir
    git pull
} else {
    Write-Host "📦 Cloning CodeForge MCP Adapter..." -ForegroundColor Green
    New-Item -ItemType Directory -Force -Path (Split-Path $installDir)
    git clone https://github.com/codeforge/mcp-adapter.git $installDir
    Set-Location $installDir
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Green
npm install

# Create global command
Write-Host "🔗 Creating global command..." -ForegroundColor Green
npm link

# Create batch file for global access
$batchContent = @"
@echo off
node "$installDir\index.js" %*
"@
$batchPath = "$env:LOCALAPPDATA\Microsoft\WindowsApps\codeforge-mcp.cmd"
Set-Content -Path $batchPath -Value $batchContent

# Set up environment
Write-Host "⚙️  Setting up environment..." -ForegroundColor Yellow
if (Test-Path .env.example) {
    Copy-Item .env.example .env -Force
}

# Configure default server
$envContent = Get-Content .env
$envContent = $envContent -replace 'MCP_SERVER_URL=.*', 'MCP_SERVER_URL=https://api.codeforge.dev/mcp'
Set-Content -Path .env -Value $envContent

Write-Host "✅ CodeForge MCP Adapter installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Installation location: $installDir" -ForegroundColor Cyan
Write-Host "🔧 Configuration file: $installDir\.env" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure your IDE (see instructions below)"
Write-Host "2. Run 'codeforge-mcp test' to verify installation"
Write-Host "3. Start using CodeForge in your IDE!"
```

Run the installation script:
```bash
# macOS/Linux
chmod +x install-codeforge-adapter.sh
./install-codeforge-adapter.sh

# Windows (PowerShell as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\install-codeforge-adapter.ps1
```

#### Option 2: Manual Installation

```bash
# 1. Clone the repository
git clone https://github.com/codeforge/mcp-adapter.git
cd mcp-adapter

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env

# 4. Edit .env file with your configuration
# Set MCP_SERVER_URL to your CodeForge server
# Default: https://api.codeforge.dev/mcp

# 5. Make the script executable (macOS/Linux)
chmod +x index.js

# 6. Create a global link (optional)
npm link
# Or add to PATH
export PATH="$PATH:$(pwd)"
```

#### Option 3: Development Installation

For development or testing with local modifications:

```bash
# Clone and set up for development
git clone https://github.com/codeforge/mcp-adapter.git
cd mcp-adapter

# Install dependencies including dev dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Or run tests
npm test
```

### Verify Installation

After installation, verify everything is working:

```bash
# Test the adapter directly
node ~/.codeforge/mcp-adapter/index.js --version

# Or if you created the global command
codeforge-mcp --version

# Test connection to server
codeforge-mcp test-connection

# Check project detection
codeforge-mcp analyze --project .
```

## 🎮 IDE Configuration

### Cursor IDE

After installing the adapter, configure Cursor to use it:

1. Open Cursor Settings (`Cmd/Ctrl + ,`)
2. Search for "Model Context Protocol" or "MCP"
3. Add configuration:

```json
{
  "mcpServers": {
    "codeforge": {
      "command": "node",
      "args": [
        "${HOME}/.codeforge/mcp-adapter/index.js"
      ],
      "env": {
        "MCP_SERVER_URL": "https://api.codeforge.dev/mcp",
        "CODEFORGE_PROJECT_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

For Windows, use:
```json
{
  "mcpServers": {
    "codeforge": {
      "command": "node",
      "args": [
        "${env:USERPROFILE}\\.codeforge\\mcp-adapter\\index.js"
      ],
      "env": {
        "MCP_SERVER_URL": "https://api.codeforge.dev/mcp",
        "CODEFORGE_PROJECT_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

### VS Code with Continue

1. Install the Continue extension
2. Open `.continue/config.json`
3. Add to `contextProviders`:

```json
{
  "contextProviders": [
    {
      "name": "codeforge",
      "provider": "mcp",
      "config": {
        "command": "node",
        "args": ["~/.codeforge/mcp-adapter/index.js"],
        "env": {
          "MCP_SERVER_URL": "https://api.codeforge.dev/mcp"
        }
      }
    }
  ]
}
```

### VS Code with GitHub Copilot

1. Install the MCP extension for Copilot
2. Add to `.vscode/settings.json`:

```json
{
  "github.copilot.mcp.servers": {
    "codeforge": {
      "command": "node",
      "args": ["~/.codeforge/mcp-adapter/index.js"],
      "env": {
        "CODEFORGE_AUTO_APPLY": "true"
      }
    }
  }
}
```

## 🛠️ Configuration

### Environment Variables

The adapter uses a `.env` file for configuration. Edit `~/.codeforge/mcp-adapter/.env`:

```env
# Server Configuration
MCP_SERVER_URL=https://api.codeforge.dev/mcp
# For local development:
# MCP_SERVER_URL=http://localhost:8080/mcp

# Optional API Key (if server requires authentication)
# CODEFORGE_API_KEY=your-api-key-here

# Adapter Settings
AUTO_BACKUP=true
BACKUP_DIR=.mcp-backups
LOG_LEVEL=info

# Connection Settings
MCP_SERVER_TIMEOUT=30000
```

### Project Configuration

Create `.codeforgerc.json` in your project root for project-specific settings:

```json
{
  "adapter": {
    "autoApply": true,
    "backupBeforeModify": true,
    "confirmDestructive": true
  },
  "project": {
    "type": "auto-detect",
    "framework": "spring-boot",
    "language": "java"
  },
  "preferences": {
    "lombok": true,
    "validation": true,
    "testGeneration": false
  }
}
```

## 📚 Available Tools

The adapter exposes these tools to your IDE:

### `generate_postgresql_integration`
Generate complete PostgreSQL integration:
```
Generate PostgreSQL integration for user management with authentication
```

### `get_postgresql_integration_status`
Check the status of PostgreSQL integration:
```
Check PostgreSQL integration status
```

## 🔄 Running the Adapter

### For Development

```bash
# Run directly with Node.js
cd ~/.codeforge/mcp-adapter
node index.js

# Run with debug output
LOG_LEVEL=debug node index.js

# Run with custom server
MCP_SERVER_URL=http://localhost:8080/mcp node index.js

# Run with hot reload (if nodemon is installed)
npm run dev
```

### As a Service (Optional)

**macOS/Linux (using systemd)**:

Create `~/.config/systemd/user/codeforge-mcp.service`:
```ini
[Unit]
Description=CodeForge MCP Adapter
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /home/YOUR_USER/.codeforge/mcp-adapter/index.js
Restart=always
Environment="MCP_SERVER_URL=https://api.codeforge.dev/mcp"

[Install]
WantedBy=default.target
```

Enable and start:
```bash
systemctl --user enable codeforge-mcp
systemctl --user start codeforge-mcp
```

**Windows (using Task Scheduler)**:

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: "When I log on"
4. Set action: Start a program
5. Program: `node.exe`
6. Arguments: `%USERPROFILE%\.codeforge\mcp-adapter\index.js`

## 💾 Backup System

The adapter automatically creates backups before modifying files:

```bash
.mcp-backups/
├── 2024-01-15_10-30-45/
│   ├── manifest.json
│   ├── src/main/java/com/example/User.java.backup
│   └── pom.xml.backup
└── 2024-01-15_11-45-20/
    └── ...
```

### Restore from Backup

```bash
# List available backups
ls -la .mcp-backups/

# Restore specific backup manually
cp .mcp-backups/2024-01-15_10-30-45/*.backup .

# Or use the built-in restore (if available)
node ~/.codeforge/mcp-adapter/scripts/restore.js --backup 2024-01-15_10-30-45
```

## 📊 Monitoring & Logs

### View Logs

```bash
# View adapter logs
tail -f ~/.codeforge/mcp-adapter/logs/adapter.log

# View request logs
tail -f ~/.codeforge/mcp-adapter/logs/requests.log

# Enable debug logging
LOG_LEVEL=debug node ~/.codeforge/mcp-adapter/index.js
```

### Log Locations

- **Adapter logs**: `~/.codeforge/mcp-adapter/logs/adapter.log`
- **Request logs**: `~/.codeforge/mcp-adapter/logs/requests.log`
- **Error logs**: `~/.codeforge/mcp-adapter/logs/error.log`

## 🔧 Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
   ```bash
   # Reinstall dependencies
   cd ~/.codeforge/mcp-adapter
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **"Permission denied" errors**
   ```bash
   # Fix permissions
   chmod +x ~/.codeforge/mcp-adapter/index.js
   chmod -R 755 ~/.codeforge/mcp-adapter
   ```

3. **"Cannot connect to server"**
   ```bash
   # Test server connection
   curl https://api.codeforge.dev/mcp/health
   
   # Check environment variables
   cat ~/.codeforge/mcp-adapter/.env | grep MCP_SERVER_URL
   ```

4. **IDE not recognizing adapter**
   ```bash
   # Check if adapter is running
   ps aux | grep codeforge-mcp
   
   # Test adapter directly
   node ~/.codeforge/mcp-adapter/index.js test-connection
   ```

## 🚀 Development

### Project Structure

```
mcp-adapter/
├── index.js                 # Main entry point
├── package.json            # Dependencies and scripts
├── .env.example            # Environment template
├── src/
│   ├── server.js          # MCP server implementation
│   ├── tools/             # Tool implementations
│   │   ├── postgresqlTool.js
│   │   └── statusTool.js
│   ├── services/          # Service layer
│   │   ├── mcpService.js
│   │   └── fileService.js
│   └── utils/             # Utilities
│       └── logger.js
├── scripts/
│   ├── install.sh         # Installation script
│   ├── test-connection.js # Connection tester
│   └── debug-integration.js
└── logs/                  # Log files (created at runtime)
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- --grep "PostgreSQL"

# Run with coverage
npm run test:coverage
```

### Building for Distribution

```bash
# Create distribution package
npm run build

# This creates a standalone package that can be distributed
# Output: dist/codeforge-mcp-adapter.tar.gz
```

## 🐛 Debugging

### Enable Debug Mode

```bash
# Set debug environment variable
export DEBUG=codeforge:*
export LOG_LEVEL=debug

# Run adapter
node ~/.codeforge/mcp-adapter/index.js

# Or in one line
DEBUG=codeforge:* LOG_LEVEL=debug node ~/.codeforge/mcp-adapter/index.js
```

### Debug Scripts

```bash
# Test server connection
node ~/.codeforge/mcp-adapter/scripts/test-connection.js

# Debug integration flow
node ~/.codeforge/mcp-adapter/scripts/debug-integration.js

# Check working directory
node ~/.codeforge/mcp-adapter/debug-cwd.js
```

## 📈 Performance

- **Startup Time**: < 500ms
- **Request Processing**: < 100ms local, + network latency
- **File Operations**: Instant for < 100 files
- **Memory Usage**: ~50MB baseline
- **Cache Hit Rate**: > 90% for repeated operations

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

## 🔗 Links

- **Repository**: [github.com/codeforge/mcp-adapter](https://github.com/codeforge/mcp-adapter)
- **Documentation**: [docs.codeforge.dev/adapter](https://docs.codeforge.dev/adapter)
- **Issue Tracker**: [github.com/codeforge/mcp-adapter/issues](https://github.com/codeforge/mcp-adapter/issues)
- **Discord Support**: [discord.gg/codeforge](https://discord.gg/codeforge)

---

<div align="center">

**Your AI coding companion, powered by CodeForge**

*Making every developer a 10x developer*

</div>