import chalk from 'chalk';

export class Logger {
  constructor(level = 'info') {
    this.level = level;
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.currentLevel = this.levels[level] || 1;
  }

  debug(message, ...args) {
    if (this.currentLevel <= this.levels.debug) {
      console.error(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  info(message, ...args) {
    if (this.currentLevel <= this.levels.info) {
      console.error(chalk.blue(`[INFO] ${message}`), ...args);
    }
  }

  warn(message, ...args) {
    if (this.currentLevel <= this.levels.warn) {
      console.error(chalk.yellow(`[WARN] ${message}`), ...args);
    }
  }

  error(message, ...args) {
    if (this.currentLevel <= this.levels.error) {
      console.error(chalk.red(`[ERROR] ${message}`), ...args);
    }
  }
}