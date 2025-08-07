import fetch from 'node-fetch';

export class McpService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.baseUrl = config.mcpServerUrl;
    this.timeout = config.timeout;
  }

  async testConnection() {
    try {
      const response = await this.makeRequest('/health', 'GET');
      if (response.status === 'UP') {
        return true;
      }
      throw new Error('Health check failed');
    } catch (error) {
      throw new Error(`Cannot connect to MCP server at ${this.baseUrl}: ${error.message}`);
    }
  }

  async createPlan({ projectPath, description, preferences }) {
    return await this.makeRequest('/plan/create', 'POST', {
      action: 'create_plan',
      capability: 'postgresql',
      projectInfo: {
        path: projectPath,
        description: description
      },
      preferences: preferences
    });
  }

  async executePlan({ planId, schema }) {
    return await this.makeRequest('/plan/execute', 'POST', {
      action: 'execute_plan',
      planId: planId,
      schema: schema,
      options: {
        generateTests: false
      }
    });
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: this.timeout
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    this.logger.debug(`Making ${method} request to: ${url}`);

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Unknown server error');
      }

      return data;
    } catch (error) {
      this.logger.error(`Request failed: ${error.message}`);
      throw error;
    }
  }
}