#!/usr/bin/env node

import { McpService } from '/src/services/mcpService.js';
import { FileService } from '/src/services/fileService.js';
import { PostgreSQLTool } from '/src/tools/postgresqlTool.js';
import { Logger } from '/src/utils/logger.js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const config = {
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp',
  timeout: 30000,
  autoBackup: true,
  backupDir: '.mcp-backups'
};

const logger = new Logger('debug');

async function testCombinedTool() {
  console.log(chalk.blue.bold('\n🧪 Testing Combined PostgreSQL Tool\n'));
  
  const mcpService = new McpService(config, logger);
  const fileService = new FileService(config, logger);
  const postgresqlTool = new PostgreSQLTool(mcpService, fileService, logger);
  
  try {
    // Test connection first
    console.log(chalk.yellow('Testing connection...'));
    await mcpService.testConnection();
    console.log(chalk.green('✅ Connection successful!\n'));
    
    // Define tool arguments (what Cursor would send)
    const toolArgs = {
      projectPath: '.',
      description: 'User management system for web application',
      schema: {
        tables: [{
          name: 'users',
          fields: [
            { 
              name: 'id', 
              type: 'BIGINT', 
              primaryKey: true, 
              autoIncrement: true,
              nullable: false
            },
            { 
              name: 'username', 
              type: 'VARCHAR', 
              length: 50, 
              unique: true, 
              nullable: false 
            },
            { 
              name: 'email', 
              type: 'VARCHAR', 
              length: 100, 
              unique: true, 
              nullable: false 
            },
            {
              name: 'password',
              type: 'VARCHAR',
              length: 255,
              nullable: false
            },
            {
              name: 'first_name',
              type: 'VARCHAR',
              length: 50,
              nullable: true
            },
            {
              name: 'last_name',
              type: 'VARCHAR',
              length: 50,
              nullable: true
            },
            {
              name: 'active',
              type: 'BOOLEAN',
              nullable: false,
              defaultValue: 'true'
            },
            { 
              name: 'created_at', 
              type: 'TIMESTAMP', 
              nullable: false,
              defaultValue: 'CURRENT_TIMESTAMP'
            },
            { 
              name: 'updated_at', 
              type: 'TIMESTAMP', 
              nullable: false,
              defaultValue: 'CURRENT_TIMESTAMP'
            }
          ]
        }]
      },
      preferences: {
        useLombok: true,
        includeValidation: true,
        namingStrategy: 'snake_case'
      },
      applyToProject: false // Set to true to actually create files
    };
    
    console.log(chalk.yellow('Executing combined tool with arguments:'));
    console.log(chalk.gray(JSON.stringify(toolArgs, null, 2)));
    console.log();
    
    // Execute the tool
    const result = await postgresqlTool.execute(toolArgs);
    
    // Display the result
    console.log(chalk.green.bold('\n✅ Tool executed successfully!\n'));
    console.log(chalk.cyan('Result:'));
    console.log(result.content[0].text);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Test failed:'), error.message);
    console.error(chalk.red('Stack:'), error.stack);
  }
}

// Run the test
console.log(chalk.blue.bold('Combined PostgreSQL Tool Tester'));
console.log(chalk.gray('This simulates how Cursor would call the tool'));
console.log(chalk.gray('Server URL:'), config.mcpServerUrl);

testCombinedTool();