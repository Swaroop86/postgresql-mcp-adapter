import fs from 'fs/promises';
import path from 'path';

export class FileService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projectRoot = process.cwd();
    this.backupDir = config.backupDir;
  }

  async applyGeneratedFiles(generatedFiles) {
    let filesApplied = 0;

    // Create backup directory if it doesn't exist
    if (this.config.autoBackup) {
      await this.ensureBackupDirectory();
    }

    for (const category of generatedFiles) {
      this.logger.info(`Applying ${category.files.length} files for category: ${category.category}`);

      for (const file of category.files) {
        try {
          const fullPath = path.resolve(this.projectRoot, file.path);
          
          // Create directory if it doesn't exist
          await fs.mkdir(path.dirname(fullPath), { recursive: true });

          if (file.action === 'create' || file.action === 'modify') {
            // Backup existing file if it exists and backup is enabled
            if (this.config.autoBackup) {
              await this.createBackup(fullPath, file.path);
            }

            // Write the new content
            await fs.writeFile(fullPath, file.content, 'utf8');
            filesApplied++;
            
            this.logger.info(`✅ Applied: ${file.path}`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to apply ${file.path}: ${error.message}`);
        }
      }
    }

    this.logger.info(`Successfully applied ${filesApplied} files`);
    return filesApplied;
  }

  async createBackup(fullPath, relativePath) {
    try {
      await fs.access(fullPath);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${path.basename(relativePath)}.backup.${timestamp}`;
      const backupPath = path.join(this.backupDir, backupFileName);
      
      await fs.copyFile(fullPath, backupPath);
      this.logger.debug(`📁 Created backup: ${backupPath}`);
    } catch {
      // File doesn't exist, no backup needed
    }
  }

  async ensureBackupDirectory() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      this.logger.warn(`Failed to create backup directory: ${error.message}`);
    }
  }

  async checkIntegrationStatus(projectPath) {
    try {
      // Check for PostgreSQL integration components
      const pomPath = path.join(projectPath, 'pom.xml');
      const applicationYmlPath = path.join(projectPath, 'src/main/resources/application.yml');
      
      let hasJPA = false;
      let hasPostgreSQL = false;
      let hasValidation = false;
      let hasDataSourceConfig = false;

      // Check pom.xml
      try {
        const pomContent = await fs.readFile(pomPath, 'utf8');
        hasJPA = pomContent.includes('spring-boot-starter-data-jpa');
        hasPostgreSQL = pomContent.includes('postgresql');
        hasValidation = pomContent.includes('spring-boot-starter-validation');
      } catch {
        this.logger.debug('pom.xml not found');
      }

      // Check application.yml
      try {
        const appConfig = await fs.readFile(applicationYmlPath, 'utf8');
        hasDataSourceConfig = appConfig.includes('datasource') && appConfig.includes('postgresql');
      } catch {
        this.logger.debug('application.yml not found');
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
    } catch {
      // Directory not accessible
    }
    return files;
  }
}