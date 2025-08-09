#!/usr/bin/env node

/**
 * PostgreSQL MCP Adapter - Main Server
 * Fixed to properly capture and use Cursor's working directory
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { PostgreSQLTool } from './tools/postgresqlTool.js';
import { StatusTool } from './tools/statusTool.js';
import { McpService } from './services/mcpService.js';
import { FileService } from './services/fileService.js';
import { Logger } from './utils/logger.js';

export class PostgreSQLMCPServer {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    
    // CRITICAL: Capture the initial working directory when server starts
    // This is the directory where Cursor invoked the MCP adapter
    this.cursorProjectDirectory = process.cwd();
    
    this.logger.info('=== MCP Server Initialization ===');
    this.logger.info(`Initial working directory (Cursor project): ${this.cursorProjectDirectory}`);
    this.logger.info(`Process arguments: ${process.argv.join(' ')}`);
    this.logger.info(`Environment PWD: ${process.env.PWD}`);
    this.logger.info(`Platform: ${process.platform}`);
    
    // Initialize services with the correct project directory
    this.mcpService = new McpService(config, this.logger);
    this.fileService = new FileService(config, this.logger);
    
    // Set the project root to Cursor's working directory
    this.fileService.setProjectRoot(this.cursorProjectDirectory);
    
    // Initialize tools with proper context
    this.tools = {
      postgresql: new PostgreSQLTool(
        this.mcpService, 
        this.fileService, 
        this.logger,
        this.cursorProjectDirectory  // Pass the directory to the tool
      ),
      status: new StatusTool(this.fileService, this.logger)
    };

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'postgresql-integration',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          this.tools.postgresql.getDefinition(),
          this.tools.status.getDefinition()
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        this.logger.info(`Executing tool: ${name}`);
        this.logger.debug(`Tool arguments:`, JSON.stringify(args, null, 2));
        
        // IMPORTANT: Override projectPath with Cursor's working directory if not specified
        // or if it's just '.' (relative path)
        if (!args.projectPath || args.projectPath === '.' || args.projectPath === '/') {
          args.projectPath = this.cursorProjectDirectory;
          this.logger.info(`Using Cursor's working directory as project path: ${args.projectPath}`);
        } else if (!args.projectPath.startsWith('/') && !args.projectPath.startsWith('~')) {
          // If it's a relative path, resolve it relative to Cursor's working directory
          const path = await import('path');
          args.projectPath = path.resolve(this.cursorProjectDirectory, args.projectPath);
          this.logger.info(`Resolved relative path to: ${args.projectPath}`);
        }

        switch (name) {
          case 'generate_postgresql_integration':
            return await this.tools.postgresql.execute(args);
          
          case 'get_postgresql_integration_status':
            return await this.tools.status.execute(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        this.logger.error(`Tool execution failed: ${error.message}`);
        
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      this.logger.error('MCP Server Error:', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    try {
      // Log detailed startup information
      this.logger.info('Starting PostgreSQL MCP Adapter...');
      this.logger.info(`Node version: ${process.version}`);
      this.logger.info(`Platform: ${process.platform}`);
      this.logger.info(`Cursor Project Directory: ${this.cursorProjectDirectory}`);
      this.logger.info(`Script location: ${import.meta.url}`);
      
      // Verify the project directory is valid
      const fs = await import('fs');
      const path = await import('path');
      
      try {
        const stats = await fs.promises.stat(this.cursorProjectDirectory);
        if (stats.isDirectory()) {
          this.logger.info('✅ Project directory exists and is accessible');
          
          // Check for project markers
          const projectMarkers = ['pom.xml', 'build.gradle', 'package.json', 'src'];
          for (const marker of projectMarkers) {
            const markerPath = path.join(this.cursorProjectDirectory, marker);
            try {
              await fs.promises.access(markerPath);
              this.logger.info(`✅ Found project marker: ${marker}`);
            } catch {
              // Marker not found, continue checking
            }
          }
        }
      } catch (error) {
        this.logger.warn(`⚠️ Could not verify project directory: ${error.message}`);
      }
      
      // Test connection to Spring Boot server
      await this.mcpService.testConnection();
      this.logger.info('✅ Connection to Spring Boot server verified');

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('🚀 PostgreSQL Integration MCP Server running on stdio');
      this.logger.info('📁 Working with project at: ' + this.cursorProjectDirectory);
      this.logger.info('Available tools:');
      this.logger.info('  - generate_postgresql_integration: Complete PostgreSQL integration');
      this.logger.info('  - get_postgresql_integration_status: Check integration status');
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }
}