#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logsDir = path.join(dirname(__dirname), 'logs');
const requestLogFile = path.join(logsDir, 'requests.log');
const jsonLogFile = path.join(logsDir, 'requests.json');

// Function to display the current state
function displayLogs() {
  console.clear();
  console.log(chalk.blue.bold('🔍 MCP Request/Response Tracker\n'));
  
  // Display request log
  if (fs.existsSync(requestLogFile)) {
    const content = fs.readFileSync(requestLogFile, 'utf8');
    const lines = content.split('\n');
    const recentLines = lines.slice(-50); // Show last 50 lines
    
    console.log(chalk.yellow.bold('Recent Requests:\n'));
    recentLines.forEach(line => {
      if (line.includes('CURSOR → ADAPTER')) {
        console.log(chalk.cyan(line));
      } else if (line.includes('ADAPTER → MCP')) {
        console.log(chalk.yellow(line));
      } else if (line.includes('MCP → ADAPTER')) {
        console.log(chalk.green(line));
      } else if (line.includes('ADAPTER → CURSOR')) {
        console.log(chalk.magenta(line));
      } else if (line.includes('REQUEST #')) {
        console.log(chalk.bold(line));
      } else {
        console.log(chalk.gray(line));
      }
    });
  }
}

// Function to show request summary
function showSummary() {
  if (fs.existsSync(jsonLogFile)) {
    const content = fs.readFileSync(jsonLogFile, 'utf8');
    const logs = JSON.parse(content);
    
    console.log(chalk.green.bold('\n📊 Request Summary:\n'));
    
    // Group by request ID
    const requests = {};
    logs.forEach(entry => {
      if (!requests[entry.requestId]) {
        requests[entry.requestId] = [];
      }
      requests[entry.requestId].push(entry);
    });
    
    // Display each request flow
    Object.entries(requests).slice(-5).forEach(([requestId, entries]) => {
      console.log(chalk.bold(`\nRequest #${requestId}:`));
      
      entries.forEach(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        switch (entry.direction) {
          case 'CURSOR_TO_ADAPTER':
            console.log(chalk.cyan(`  ${time} [CURSOR→ADAPTER] ${entry.method}`));
            break;
          case 'ADAPTER_TO_MCP':
            console.log(chalk.yellow(`  ${time} [ADAPTER→MCP] ${entry.method} ${entry.endpoint}`));
            break;
          case 'MCP_TO_ADAPTER':
            console.log(chalk.green(`  ${time} [MCP→ADAPTER] Status: ${entry.status}`));
            break;
          case 'ADAPTER_TO_CURSOR':
            console.log(chalk.magenta(`  ${time} [ADAPTER→CURSOR] Response sent`));
            break;
        }
      });
    });
  }
}

// Watch for changes
function watchLogs() {
  displayLogs();
  showSummary();
  
  // Watch for file changes
  if (fs.existsSync(requestLogFile)) {
    fs.watchFile(requestLogFile, { interval: 1000 }, () => {
      displayLogs();
      showSummary();
    });
  }
  
  console.log(chalk.gray('\n\nWatching for changes... Press Ctrl+C to exit'));
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'tail':
    // Real-time tail
    watchLogs();
    break;
    
  case 'summary':
    // Show summary and exit
    showSummary();
    break;
    
  case 'clear':
    // Clear logs
    if (fs.existsSync(requestLogFile)) fs.writeFileSync(requestLogFile, '');
    if (fs.existsSync(jsonLogFile)) fs.writeFileSync(jsonLogFile, '[]');
    console.log(chalk.green('✅ Logs cleared'));
    break;
    
  default:
    console.log(chalk.blue.bold('MCP Log Viewer\n'));
    console.log('Usage:');
    console.log('  node view-logs.js tail     - Watch logs in real-time');
    console.log('  node view-logs.js summary  - Show request summary');
    console.log('  node view-logs.js clear    - Clear all logs');
    console.log('\nLog files:');
    console.log(`  Requests: ${requestLogFile}`);
    console.log(`  JSON: ${jsonLogFile}`);
}