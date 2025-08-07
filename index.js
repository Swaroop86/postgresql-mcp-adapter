#!/usr/bin/env node

/**
 * PostgreSQL MCP Adapter - Main Entry Point
 */

import { PostgreSQLMCPServer } from './src/server.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration - using environment variables instead of JSON import
const serverConfig = {
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp',
  timeout: parseInt(process.env.MCP_SERVER_TIMEOUT) || 30000,
  autoBackup: process.env.AUTO_BACKUP === 'true' || true,
  backupDir: process.env.BACKUP_DIR || '.mcp-backups',
  logLevel: process.env.LOG_LEVEL || 'info'
};

async function main() {
  try {
    console.error('🚀 Starting PostgreSQL MCP Adapter...');
    console.error(`📡 Connecting to: ${serverConfig.mcpServerUrl}`);
    
    const server = new PostgreSQLMCPServer(serverConfig);
    await server.run();
    
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('🛑 Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});