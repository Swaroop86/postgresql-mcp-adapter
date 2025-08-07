#!/usr/bin/env node

import { McpService } from '../src/services/mcpService.js';
import { Logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp',
  timeout: 5000
};

const logger = new Logger('info');

async function testConnection() {
  console.log('🔍 Testing connection to MCP server...');
  console.log(`📡 Server URL: ${config.mcpServerUrl}`);
  
  const mcpService = new McpService(config, logger);
  
  try {
    await mcpService.testConnection();
    console.log('✅ Connection successful!');
    console.log('🎉 MCP server is ready to use');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure your Spring Boot MCP server is running');
    console.log('2. Check the server URL in .env file');
    console.log('3. Verify no firewall is blocking the connection');
    process.exit(1);
  }
}

testConnection();