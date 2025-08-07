// src/services/fileService.js - Enhanced with better logging and error handling
import fs from 'fs/promises';
import path from 'path';

export class FileService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projectRoot = process.cwd();
    this.backupDir = config.backupDir || '.mcp-backups';
  }

  async applyGeneratedFiles(generatedFiles) {
    this.logger.info('Starting file application process...');
    this.logger.info(`Project root: ${this.projectRoot}`);
    
    let filesApplied = 0;
    let appliedFilesList = [];
    let errors = [];

    // Create backup directory if it doesn't exist
    if (this.config.autoBackup) {
      await this.ensureBackupDirectory();
    }

    for (const category of generatedFiles) {
      this.logger.info(`\nProcessing category: ${category.category}`);
      this.logger.info(`Files in category: ${category.files.length}`);

      for (const file of category.files) {
        try {
          this.logger.info(`\nProcessing file: ${file.path}`);
          this.logger.info(`Action: ${file.action}`);
          this.logger.info(`Content length: ${file.content ? file.content.length : 0} characters`);
          
          const fullPath = path.resolve(this.projectRoot, file.path);
          this.logger.info(`Full path: ${fullPath}`);
          
          // Create directory if it doesn't exist
          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });
          this.logger.info(`Directory ensured: ${dir}`);

          if (file.action === 'create' || file.action === 'modify') {
            // Backup existing file if it exists and backup is enabled
            if (this.config.autoBackup) {
              await this.createBackup(fullPath, file.path);
            }

            // Validate content
            if (!file.content) {
              this.logger.warn(`No content for file: ${file.path}, skipping`);
              continue;
            }

            // Write the new content
            await fs.writeFile(fullPath, file.content, 'utf8');
            filesApplied++;
            appliedFilesList.push(file.path);
            
            this.logger.info(`✅ Applied: ${file.path}`);
            
            // Verify file was written
            const stats = await fs.stat(fullPath);
            this.logger.info(`File size: ${stats.size} bytes`);
          } else {
            this.logger.info(`Skipping file with action: ${file.action}`);
          }
        } catch (error) {
          const errorMsg = `Failed to apply ${file.path}: ${error.message}`;
          this.logger.error(`❌ ${errorMsg}`);
          this.logger.error(`Error stack: ${error.stack}`);
          errors.push(errorMsg);
        }
      }
    }

    this.logger.info(`\nFile application summary:`);
    this.logger.info(`Successfully applied ${filesApplied} files`);
    if (errors.length > 0) {
      this.logger.error(`Errors encountered: ${errors.length}`);
      errors.forEach(err => this.logger.error(`  - ${err}`));
    }

    // Return detailed result
    return {
      count: filesApplied,
      files: appliedFilesList,
      errors: errors
    };
  }

  async createBackup(fullPath, relativePath) {
    try {
      await fs.access(fullPath);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${path.basename(relativePath)}.backup.${timestamp}`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      await fs.copyFile(fullPath, backupPath);
      this.logger.debug(`📁 Created backup: ${backupPath}`);
    } catch (error) {
      // File doesn't exist, no backup needed
      this.logger.debug(`No backup needed for ${relativePath} - file doesn't exist`);
    }
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      this.logger.debug(`Backup directory ensured: ${this.backupDir}`);
    } catch (error) {
      this.logger.warn(`Failed to create backup directory: ${error.message}`);
    }
  }

  async checkIntegrationStatus(projectPath) {
    try {
      this.logger.info(`Checking integration status for: ${projectPath}`);
      
      // Check for PostgreSQL integration components
      const pomPath = path.join(projectPath, 'pom.xml');
      const gradlePath = path.join(projectPath, 'build.gradle');
      const applicationYmlPath = path.join(projectPath, 'src/main/resources/application.yml');
      const applicationPropsPath = path.join(projectPath, 'src/main/resources/application.properties');
      
      let hasJPA = false;
      let hasPostgreSQL = false;
      let hasValidation = false;
      let hasDataSourceConfig = false;

      // Check build file (pom.xml or build.gradle)
      try {
        let buildContent = '';
        if (await this.fileExists(pomPath)) {
          buildContent = await fs.readFile(pomPath, 'utf8');
        } else if (await this.fileExists(gradlePath)) {
          buildContent = await fs.readFile(gradlePath, 'utf8');
        }
        
        hasJPA = buildContent.includes('spring-boot-starter-data-jpa');
        hasPostgreSQL = buildContent.includes('postgresql');
        hasValidation = buildContent.includes('spring-boot-starter-validation');
      } catch (error) {
        this.logger.debug('Build file not found or not readable');
      }

      // Check application configuration
      try {
        let appConfig = '';
        if (await this.fileExists(applicationYmlPath)) {
          appConfig = await fs.readFile(applicationYmlPath, 'utf8');
        } else if (await this.fileExists(applicationPropsPath)) {
          appConfig = await fs.readFile(applicationPropsPath, 'utf8');
        }
        
        hasDataSourceConfig = appConfig.includes('datasource') && appConfig.includes('postgresql');
      } catch (error) {
        this.logger.debug('Application config not found');
      }

      // Check for Java source structure
      const srcPath = path.join(projectPath, 'src/main/java');
      const javaFiles = await this.findJavaFiles(srcPath);
      
      const hasEntities = javaFiles.some(f => f.content.includes('@Entity'));
      const hasRepositories = javaFiles.some(f => f.content.includes('Repository') && f.path.includes('/repository/'));
      const hasServices = javaFiles.some(f => f.content.includes('@Service'));
      const hasControllers = javaFiles.some(f => f.content.includes('@RestController'));

      return {
        configured: hasJPA && hasPostgreSQL && hasDataSourceConfig,
        components: {
          dependencies: hasJPA && hasPostgreSQL,
          configuration: hasDataSourceConfig,
          entities: hasEntities,
          repositories: hasRepositories,
          services: hasServices,
          controllers: hasControllers
        }
      };
    } catch (error) {
      this.logger.error(`Failed to check integration status: ${error.message}`);
      throw error;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async findJavaFiles(dir) {
    const files = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...await this.findJavaFiles(fullPath));
        } else if (entry.name.endsWith('.java')) {
          const content = await fs.readFile(fullPath, 'utf8');
          files.push({ 
            path: fullPath, 
            content: content.slice(0, 1000) // First 1000 chars for annotation checking
          });
        }
      }
    } catch (error) {
      // Directory not accessible
      this.logger.debug(`Cannot access directory: ${dir}`);
    }
    return files;
  }
}