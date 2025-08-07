#!/usr/bin/env node

import { McpService } from '../src/services/mcpService.js';
import { Logger } from '../src/utils/logger.js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const config = {
  mcpServerUrl: process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp',
  timeout: 30000
};

const logger = new Logger('debug');

async function debugIntegration() {
  console.log(chalk.blue.bold('\n🔍 Testing MCP Integration Flow...\n'));
  
  const mcpService = new McpService(config, logger);
  
  try {
    // Step 1: Test connection
    console.log(chalk.yellow('1️⃣  Testing connection...'));
    await mcpService.testConnection();
    console.log(chalk.green('✅ Connection successful!\n'));
    
    // Step 2: Create a plan
    console.log(chalk.yellow('2️⃣  Creating plan...'));
    const planResponse = await mcpService.createPlan({
      projectPath: '.',
      description: 'Test PostgreSQL integration for user management',
      preferences: {
        useLombok: true,
        includeValidation: true,
        namingStrategy: 'snake_case'
      }
    });
    console.log(chalk.green('✅ Plan created!'));
    console.log(chalk.cyan('   Plan ID:'), planResponse.planId);
    console.log(chalk.cyan('   Status:'), planResponse.status);
    console.log(chalk.cyan('   Expires in:'), planResponse.expiresIn);
    console.log('\n');
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 3: Execute the plan
    console.log(chalk.yellow('3️⃣  Executing plan...'));
    console.log(chalk.cyan('   Using Plan ID:'), planResponse.planId);
    
    const executionResponse = await mcpService.executePlan({
      planId: planResponse.planId,
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
      }
    });
    
    console.log(chalk.green('✅ Plan executed successfully!'));
    console.log(chalk.cyan('   Execution ID:'), executionResponse.executionId);
    console.log(chalk.cyan('   Status:'), executionResponse.status);
    
    if (executionResponse.summary) {
      console.log(chalk.cyan('\n   Summary:'));
      console.log(chalk.gray('   - Files generated:'), executionResponse.summary.filesGenerated);
      console.log(chalk.gray('   - Files modified:'), executionResponse.summary.filesModified);
      console.log(chalk.gray('   - Lines of code:'), executionResponse.summary.totalLinesOfCode);
    }
    
    if (executionResponse.generatedFiles) {
      console.log(chalk.cyan('\n   Generated Files:'));
      executionResponse.generatedFiles.forEach(category => {
        console.log(chalk.gray(`   ${category.category}:`));
        category.files.forEach(file => {
          console.log(chalk.gray(`     - ${file.path} (${file.action})`));
        });
      });
    }
    
    console.log(chalk.green.bold('\n🎉 Integration test completed successfully!\n'));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Error:'), error.message);
    console.error(chalk.red('Stack:'), error.stack);
    
    console.log(chalk.yellow('\n💡 Troubleshooting tips:'));
    console.log(chalk.gray('1. Make sure the MCP server is running on port 8080'));
    console.log(chalk.gray('2. Check the server logs for detailed error messages'));
    console.log(chalk.gray('3. Verify the .env file has correct configuration'));
    console.log(chalk.gray('4. Ensure all dependencies are installed (npm install)'));
  }
}

// Run the debug script
console.log(chalk.blue.bold('MCP Integration Debugger'));
console.log(chalk.gray('Server URL:'), config.mcpServerUrl);
console.log(chalk.gray('Timeout:'), config.timeout, 'ms');

debugIntegration();