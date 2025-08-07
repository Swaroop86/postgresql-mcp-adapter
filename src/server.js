import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { PlanTool } from './tools/planTool.js';
import { ExecuteTool } from './tools/executeTool.js';
import { StatusTool } from './tools/statusTool.js';
import { McpService } from './services/mcpService.js';
import { FileService } from './services/fileService.js';
import { Logger } from './utils/logger.js';

export class PostgreSQLMCPServer {
  constructor(config) {
    this.config = config;
    this.logger = new Logger(config.logLevel);
    
    // Initialize services
    this.mcpService = new McpService(config, this.logger);
    this.fileService = new FileService(config, this.logger);
    
    // Initialize tools
    this.tools = {
      plan: new PlanTool(this.mcpService, this.logger),
      execute: new ExecuteTool(this.mcpService, this.fileService, this.logger),
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
          this.tools.plan.getDefinition(),
          this.tools.execute.getDefinition(),
          this.tools.status.getDefinition()
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        this.logger.info(`Executing tool: ${name}`);

        switch (name) {
          case 'create_postgresql_integration_plan':
            return await this.tools.plan.execute(args);
          
          case 'execute_postgresql_integration':
            return await this.tools.execute.execute(args);
          
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
      // Test connection to Spring Boot server
      await this.mcpService.testConnection();
      this.logger.info('✅ Connection to Spring Boot server verified');

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logger.info('🚀 PostgreSQL Integration MCP Server running on stdio');
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }
}