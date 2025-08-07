import fetch from 'node-fetch';

export class McpService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.baseUrl = config.mcpServerUrl;
    this.timeout = config.timeout;
    this.requestIdMap = new Map(); // Track request IDs
  }

  setCurrentRequestId(requestId) {
    this.currentRequestId = requestId;
  }

  async testConnection() {
    try {
      this.logger.info('Testing connection to MCP server...');
      const response = await this.makeRequest('/health', 'GET');
      
      if (response.status === 'UP') {
        this.logger.info('Connection test successful');
        return true;
      }
      throw new Error('Health check failed');
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      throw new Error(`Cannot connect to MCP server at ${this.baseUrl}: ${error.message}`);
    }
  }

  async createPlan({ projectPath, description, preferences }) {
    const request = {
      action: 'create_plan',
      capability: 'postgresql',
      projectInfo: {
        path: projectPath,
        description: description
      },
      preferences: preferences
    };
    
    this.logger.info('Creating plan with request:', JSON.stringify(request, null, 2));
    
    try {
      const response = await this.makeRequest('/plan/create', 'POST', request);
      
      this.logger.info('Plan created successfully!');
      this.logger.info('Plan ID:', response.planId);
      this.logger.info('Status:', response.status);
      
      return response;
    } catch (error) {
      this.logger.error('Failed to create plan:', error);
      throw error;
    }
  }

  async executePlan({ planId, schema }) {
    const request = {
      action: 'execute_plan',
      planId: planId,
      schema: schema,
      options: {
        generateTests: false
      }
    };
    
    this.logger.info('Executing plan with request:');
    this.logger.info('Plan ID:', planId);
    this.logger.info('Tables:', schema.tables?.map(t => t.name).join(', '));
    
    try {
      const response = await this.makeRequest('/plan/execute', 'POST', request);
      
      this.logger.info('Plan executed successfully!');
      this.logger.info('Execution ID:', response.executionId);
      this.logger.info('Status:', response.status);
      
      return response;
    } catch (error) {
      this.logger.error('Failed to execute plan:', error);
      throw error;
    }
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const requestId = this.currentRequestId || 'unknown';
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'MCP-Adapter/1.0',
        'X-Request-ID': `adapter-${requestId}`,
        'X-Adapter-Request-ID': String(requestId)
      },
      timeout: this.timeout
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    // Log the outgoing request
    this.logger.logAdapterToMcp(requestId, endpoint, method, body);

    try {
      const startTime = Date.now();
      const response = await fetch(url, options);
      const duration = Date.now() - startTime;
      
      this.logger.debug(`Response received in ${duration}ms - Status: ${response.status}`);
      
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        this.logger.error(`Failed to parse response as JSON: ${responseText}`);
        throw new Error(`Invalid JSON response: ${e.message}`);
      }
      
      // Log the response
      this.logger.logMcpResponse(requestId, response.status, data);
      
      if (!response.ok) {
        this.logger.error(`HTTP Error: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${JSON.stringify(data)}`);
      }
      
      if (data.error) {
        this.logger.error('Server error:', data.error);
        throw new Error(data.error.message || 'Unknown server error');
      }

      return data;
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        this.logger.error('Connection refused. Is the MCP server running?');
        throw new Error('Cannot connect to MCP server. Please ensure it is running on ' + this.baseUrl);
      }
      
      if (error.type === 'request-timeout') {
        this.logger.error(`Request timeout after ${this.timeout}ms`);
        throw new Error('Request timeout. The server might be taking too long to respond.');
      }
      
      this.logger.error('Request failed:', error.message);
      throw error;
    }
  }
}