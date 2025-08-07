import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4
    };
    this.currentLevel = this.levels[level] || 1;
    
    // Create logs directory
    this.logsDir = path.join(dirname(__dirname), '..', 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Log files
    this.mainLogFile = path.join(this.logsDir, 'adapter.log');
    this.requestLogFile = path.join(this.logsDir, 'requests.log');
    this.jsonLogFile = path.join(this.logsDir, 'requests.json');
    
    // Request counter
    this.requestCounter = 0;
    
    // Write startup message
    this.writeToFile('='.repeat(80));
    this.writeToFile(`MCP Adapter Started - ${new Date().toISOString()}`);
    this.writeToFile(`Log Level: ${level}`);
    this.writeToFile(`Process ID: ${process.pid}`);
    this.writeToFile(`Node Version: ${process.version}`);
    this.writeToFile('='.repeat(80));
  }

  writeToFile(message, file = this.mainLogFile) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(file, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  writeJsonLog(data) {
    try {
      let logs = [];
      if (fs.existsSync(this.jsonLogFile)) {
        const content = fs.readFileSync(this.jsonLogFile, 'utf8');
        if (content) {
          logs = JSON.parse(content);
        }
      }
      logs.push(data);
      fs.writeFileSync(this.jsonLogFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to write JSON log:', error);
    }
  }

  trace(message, ...args) {
    if (this.currentLevel <= this.levels.trace) {
      const msg = this.formatMessage('TRACE', message, args);
      console.error(chalk.gray(msg));
      this.writeToFile(msg);
    }
  }

  debug(message, ...args) {
    if (this.currentLevel <= this.levels.debug) {
      const msg = this.formatMessage('DEBUG', message, args);
      console.error(chalk.gray(msg));
      this.writeToFile(msg);
    }
  }

  info(message, ...args) {
    if (this.currentLevel <= this.levels.info) {
      const msg = this.formatMessage('INFO', message, args);
      console.error(chalk.blue(msg));
      this.writeToFile(msg);
    }
  }

  warn(message, ...args) {
    if (this.currentLevel <= this.levels.warn) {
      const msg = this.formatMessage('WARN', message, args);
      console.error(chalk.yellow(msg));
      this.writeToFile(msg);
    }
  }

  error(message, ...args) {
    if (this.currentLevel <= this.levels.error) {
      const msg = this.formatMessage('ERROR', message, args);
      console.error(chalk.red(msg));
      this.writeToFile(msg);
    }
  }

  formatMessage(level, message, args) {
    const formattedArgs = args.map(arg => {
      if (typeof arg === 'object') {
        return JSON.stringify(arg, null, 2);
      }
      return arg;
    }).join(' ');
    
    return `[${level}] ${message} ${formattedArgs}`.trim();
  }

  // Special methods for request tracking
  logCursorRequest(method, params, id) {
    const requestId = ++this.requestCounter;
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      requestId,
      timestamp,
      direction: 'CURSOR_TO_ADAPTER',
      method,
      params,
      jsonrpcId: id
    };
    
    // Write to request log
    this.writeToFile(`\n${'='.repeat(80)}`, this.requestLogFile);
    this.writeToFile(`REQUEST #${requestId} - CURSOR → ADAPTER`, this.requestLogFile);
    this.writeToFile(`Timestamp: ${timestamp}`, this.requestLogFile);
    this.writeToFile(`Method: ${method}`, this.requestLogFile);
    this.writeToFile(`JSON-RPC ID: ${id}`, this.requestLogFile);
    this.writeToFile(`Params: ${JSON.stringify(params, null, 2)}`, this.requestLogFile);
    
    // Write to JSON log
    this.writeJsonLog(logEntry);
    
    // Also log to console
    console.error(chalk.cyan.bold(`\n🔵 [REQUEST #${requestId}] CURSOR → ADAPTER`));
    console.error(chalk.cyan(`   Method: ${method}`));
    console.error(chalk.cyan(`   ID: ${id}`));
    
    return requestId;
  }

  logAdapterToMcp(requestId, endpoint, method, body) {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      requestId,
      timestamp,
      direction: 'ADAPTER_TO_MCP',
      endpoint,
      method,
      body
    };
    
    // Write to request log
    this.writeToFile(`\n[REQUEST #${requestId}] ADAPTER → MCP SERVER`, this.requestLogFile);
    this.writeToFile(`Endpoint: ${endpoint}`, this.requestLogFile);
    this.writeToFile(`Method: ${method}`, this.requestLogFile);
    this.writeToFile(`Body: ${JSON.stringify(body, null, 2)}`, this.requestLogFile);
    
    // Write to JSON log
    this.writeJsonLog(logEntry);
    
    // Console log
    console.error(chalk.yellow.bold(`\n🟡 [REQUEST #${requestId}] ADAPTER → MCP`));
    console.error(chalk.yellow(`   Endpoint: ${endpoint}`));
    console.error(chalk.yellow(`   Method: ${method}`));
  }

  logMcpResponse(requestId, status, response) {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      requestId,
      timestamp,
      direction: 'MCP_TO_ADAPTER',
      status,
      response
    };
    
    // Write to request log
    this.writeToFile(`\n[REQUEST #${requestId}] MCP → ADAPTER RESPONSE`, this.requestLogFile);
    this.writeToFile(`Status: ${status}`, this.requestLogFile);
    this.writeToFile(`Response: ${JSON.stringify(response, null, 2)}`, this.requestLogFile);
    
    // Write to JSON log
    this.writeJsonLog(logEntry);
    
    // Console log
    console.error(chalk.green.bold(`\n🟢 [REQUEST #${requestId}] MCP → ADAPTER`));
    console.error(chalk.green(`   Status: ${status}`));
  }

  logAdapterResponse(requestId, response, jsonrpcId) {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      requestId,
      timestamp,
      direction: 'ADAPTER_TO_CURSOR',
      response,
      jsonrpcId
    };
    
    // Write to request log
    this.writeToFile(`\n[REQUEST #${requestId}] ADAPTER → CURSOR RESPONSE`, this.requestLogFile);
    this.writeToFile(`JSON-RPC ID: ${jsonrpcId}`, this.requestLogFile);
    this.writeToFile(`Response: ${JSON.stringify(response, null, 2)}`, this.requestLogFile);
    this.writeToFile(`${'='.repeat(80)}\n`, this.requestLogFile);
    
    // Write to JSON log
    this.writeJsonLog(logEntry);
    
    // Console log
    console.error(chalk.magenta.bold(`\n🟣 [REQUEST #${requestId}] ADAPTER → CURSOR`));
    console.error(chalk.magenta(`   Completed successfully`));
  }

  // Get log file paths
  getLogPaths() {
    return {
      main: this.mainLogFile,
      requests: this.requestLogFile,
      json: this.jsonLogFile
    };
  }
}