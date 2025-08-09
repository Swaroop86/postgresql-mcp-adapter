// src/services/fileService.js - Fixed to properly use project root
import fs from 'fs/promises';
import path from 'path';

export class FileService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projectRoot = null; // Will be set explicitly
    this.backupDir = config.backupDir || '.mcp-backups';
    this.removeProjectNameFromPath = true;
  }

  // Method to set the project root explicitly
  setProjectRoot(projectRoot) {
    this.projectRoot = projectRoot;
    this.logger.info(`FileService: Project root set to: ${this.projectRoot}`);
    
    // Verify the project root is valid
    this.verifyProjectRoot();
  }

  async verifyProjectRoot() {
    if (!this.projectRoot) {
      this.logger.error('Project root is not set!');
      return false;
    }

    try {
      const stats = await fs.stat(this.projectRoot);
      if (!stats.isDirectory()) {
        this.logger.error(`Project root is not a directory: ${this.projectRoot}`);
        return false;
      }
      
      // Check if it's writable
      await fs.access(this.projectRoot, fs.constants.W_OK);
      this.logger.info(`✅ Project root is valid and writable: ${this.projectRoot}`);
      return true;
    } catch (error) {
      this.logger.error(`Project root verification failed: ${error.message}`);
      return false;
    }
  }

  getProjectRoot() {
    return this.projectRoot;
  }

  // Method to control whether to remove project name from paths
  setRemoveProjectNameFromPath(remove) {
    this.removeProjectNameFromPath = remove;
    this.logger.info(`Remove project name from path: ${remove}`);
  }

  async applyGeneratedFiles(generatedFiles) {
    if (!this.projectRoot) {
      throw new Error('Project root is not set. Cannot apply files.');
    }

    this.logger.info('=== Starting File Application Process ===');
    this.logger.info(`Project root: ${this.projectRoot}`);
    
    // Verify project root before proceeding
    const isValid = await this.verifyProjectRoot();
    if (!isValid) {
      throw new Error(`Invalid project root: ${this.projectRoot}`);
    }
    
    let filesApplied = 0;
    let appliedFilesList = [];
    let errors = [];

    // Create backup directory if it doesn't exist
    if (this.config.autoBackup) {
      await this.ensureBackupDirectory();
    }

    for (const category of generatedFiles) {
      this.logger.info(`\n📦 Processing category: ${category.category}`);
      this.logger.info(`   Files in category: ${category.files.length}`);

      for (const file of category.files) {
        try {
          // Process the file path
          let correctedPath = file.path;
          let correctedContent = file.content;
          
          // Remove leading slash if present
          if (correctedPath.startsWith('/')) {
            correctedPath = correctedPath.substring(1);
          }
          
          // Handle package path corrections if needed
          if (this.removeProjectNameFromPath && correctedPath.includes('/com/example/')) {
            const pathPattern = /^(.*\/com\/example\/)([^\/]+)\/(.*)/;
            const match = correctedPath.match(pathPattern);
            
            if (match) {
              const basePath = match[1];
              const middlePart = match[2];
              const restOfPath = match[3];
              
              // Check if the middle part looks like a project name (has underscore or all lowercase)
              if (middlePart.includes('_') || middlePart === middlePart.toLowerCase()) {
                correctedPath = basePath + restOfPath;
                this.logger.info(`   Correcting path from: ${file.path} to: ${correctedPath}`);
                
                // Also fix package declarations in Java files
                if (file.content && file.path.endsWith('.java')) {
                  correctedContent = file.content.replace(
                    new RegExp(`com\\.example\\.${middlePart}\\.`, 'g'),
                    'com.example.'
                  );
                }
              }
            }
          }
          
          this.logger.info(`   📄 Processing file: ${correctedPath}`);
          this.logger.info(`      Action: ${file.action}`);
          
          // Build the full path - ALWAYS relative to project root
          const fullPath = path.resolve(this.projectRoot, correctedPath);
          this.logger.info(`      Full path: ${fullPath}`);
          
          // Security check - ensure the path is within project root
          const normalizedFullPath = path.normalize(fullPath);
          const normalizedProjectRoot = path.normalize(this.projectRoot);
          if (!normalizedFullPath.startsWith(normalizedProjectRoot)) {
            throw new Error(`Security error: File would be written outside project root: ${correctedPath}`);
          }
          
          // Create directory if it doesn't exist
          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });
          this.logger.debug(`      Directory ensured: ${dir}`);

          if (file.action === 'create' || file.action === 'modify' || file.action === 'append') {
            // Backup existing file if it exists
            if (this.config.autoBackup) {
              await this.createBackup(fullPath, correctedPath);
            }

            // Validate content
            if (!correctedContent) {
              this.logger.warn(`      ⚠️ No content for file: ${correctedPath}, skipping`);
              continue;
            }

            // Handle different actions
            if (file.action === 'create') {
              await fs.writeFile(fullPath, correctedContent, 'utf8');
              this.logger.info(`      ✅ Created: ${correctedPath}`);
            } else if (file.action === 'append') {
              await fs.appendFile(fullPath, correctedContent, 'utf8');
              this.logger.info(`      ✅ Appended to: ${correctedPath}`);
            } else if (file.action === 'modify') {
              // Check if file exists
              let fileExists = false;
              let existingContent = '';
              
              try {
                existingContent = await fs.readFile(fullPath, 'utf8');
                fileExists = true;
              } catch (error) {
                fileExists = false;
              }

              if (!fileExists) {
                // File doesn't exist, create it
                await fs.writeFile(fullPath, correctedContent, 'utf8');
                this.logger.info(`      ✅ Created (was modify): ${correctedPath}`);
              } else {
                // File exists, merge content
                const mergedContent = await this.mergeFileContent(
                  existingContent, 
                  correctedContent, 
                  correctedPath,
                  file.mergeStrategy || 'smart'
                );
                await fs.writeFile(fullPath, mergedContent, 'utf8');
                this.logger.info(`      ✅ Modified: ${correctedPath}`);
              }
            }
            
            filesApplied++;
            appliedFilesList.push(correctedPath);
            
            // Verify file was written
            try {
              const stats = await fs.stat(fullPath);
              this.logger.debug(`      File size: ${stats.size} bytes`);
            } catch (error) {
              this.logger.warn(`      Could not verify file: ${error.message}`);
            }
          } else {
            this.logger.info(`      Skipping file with action: ${file.action}`);
          }
        } catch (error) {
          const errorMsg = `Failed to apply ${file.path}: ${error.message}`;
          this.logger.error(`   ❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    this.logger.info(`\n=== File Application Summary ===`);
    this.logger.info(`✅ Successfully applied: ${filesApplied} files`);
    this.logger.info(`📁 Project root: ${this.projectRoot}`);
    if (errors.length > 0) {
      this.logger.error(`❌ Errors encountered: ${errors.length}`);
      errors.forEach(err => this.logger.error(`   - ${err}`));
    }

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
      const backupPath = path.join(this.projectRoot, this.backupDir, backupFileName);
      
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.copyFile(fullPath, backupPath);
      this.logger.debug(`Created backup: ${backupPath}`);
    } catch (error) {
      // File doesn't exist, no backup needed
      this.logger.debug(`No backup needed for ${relativePath} - file doesn't exist`);
    }
  }

  async ensureBackupDirectory() {
    try {
      const backupDirPath = path.join(this.projectRoot, this.backupDir);
      await fs.mkdir(backupDirPath, { recursive: true });
      this.logger.debug(`Backup directory ensured: ${backupDirPath}`);
    } catch (error) {
      this.logger.warn(`Failed to create backup directory: ${error.message}`);
    }
  }

  // ... rest of the merge methods remain the same ...
  async mergeFileContent(existingContent, newContent, filePath, strategy = 'smart') {
    const ext = path.extname(filePath).toLowerCase();
    
    this.logger.info(`Merging content for ${filePath} using strategy: ${strategy}`);
    
    if (strategy === 'append') {
      return existingContent + '\n' + newContent;
    }
    
    if (strategy === 'replace') {
      return newContent;
    }
    
    // Smart merge based on file type
    switch (ext) {
      case '.java':
        return this.mergeJavaFile(existingContent, newContent);
      case '.xml':
        if (filePath.includes('pom.xml')) {
          return this.mergePomXml(existingContent, newContent);
        }
        return this.mergeXmlFile(existingContent, newContent);
      case '.properties':
      case '.yml':
      case '.yaml':
        return this.mergeConfigFile(existingContent, newContent);
      default:
        return existingContent + '\n\n' + newContent;
    }
  }

  // ... rest of the merge helper methods remain the same ...
  mergeJavaFile(existingContent, newContent) {
    const existingImports = this.extractJavaImports(existingContent);
    const newImports = this.extractJavaImports(newContent);
    const allImports = [...new Set([...existingImports, ...newImports])];
    
    if (existingContent.includes('@RestController') || existingContent.includes('@Service')) {
      const classMatch = existingContent.match(/^([\s\S]*?)(}\s*)$/);
      if (classMatch) {
        const beforeClosingBrace = classMatch[1];
        const closingBrace = classMatch[2];
        const newMethods = this.extractJavaMethods(newContent);
        
        let merged = beforeClosingBrace;
        if (newMethods.length > 0) {
          merged += '\n\n    // Added by MCP integration\n';
          merged += newMethods.join('\n\n');
        }
        merged += closingBrace;
        
        return this.updateJavaImports(merged, allImports);
      }
    }
    
    return existingContent + '\n\n// === Added by MCP Integration ===\n' + newContent;
  }

  extractJavaImports(content) {
    const importRegex = /import\s+(?:static\s+)?([^;]+);/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[0]);
    }
    
    return imports;
  }

  extractJavaMethods(content) {
    const methodRegex = /((?:@\w+(?:\([^)]*\))?\s*)*(?:public|private|protected)\s+[\w<>,\s]+\s+\w+\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{[^}]*\})/g;
    const methods = [];
    let match;
    
    while ((match = methodRegex.exec(content)) !== null) {
      methods.push('    ' + match[1].trim());
    }
    
    return methods;
  }

  updateJavaImports(content, imports) {
    const packageMatch = content.match(/package\s+[^;]+;/);
    if (!packageMatch) return content;
    
    const packageEnd = packageMatch.index + packageMatch[0].length;
    const withoutImports = content.replace(/\nimport\s+(?:static\s+)?[^;]+;/g, '');
    const importSection = imports.length > 0 ? '\n\n' + imports.join('\n') : '';
    
    return withoutImports.slice(0, packageEnd) + importSection + withoutImports.slice(packageEnd);
  }

  mergePomXml(existingContent, newContent) {
    if (newContent.includes('<dependency>')) {
      const dependenciesMatch = existingContent.match(/<dependencies>([\s\S]*?)<\/dependencies>/);
      if (dependenciesMatch) {
        const existingDeps = dependenciesMatch[1];
        const newDepsMatch = newContent.match(/<dependency>[\s\S]*?<\/dependency>/g);
        if (newDepsMatch) {
          const updatedDeps = existingDeps + '\n' + newDepsMatch.join('\n') + '\n    ';
          return existingContent.replace(
            /<dependencies>[\s\S]*?<\/dependencies>/,
            `<dependencies>${updatedDeps}</dependencies>`
          );
        }
      }
    }
    
    return existingContent + '\n\n<!-- Added by MCP Integration -->\n' + newContent;
  }

  mergeXmlFile(existingContent, newContent) {
    return existingContent + '\n\n<!-- Added by MCP Integration -->\n' + newContent;
  }

  mergeConfigFile(existingContent, newContent) {
    const separator = existingContent.includes('=') ? 
      '\n\n# Added by MCP Integration\n' : 
      '\n\n# Added by MCP Integration\n';
    
    return existingContent + separator + newContent;
  }

  // ... rest of the methods remain the same ...
  async checkIntegrationStatus(projectPath) {
    const checkPath = projectPath || this.projectRoot;
    if (!checkPath) {
      throw new Error('No project path specified for status check');
    }

    this.logger.info(`Checking integration status for: ${checkPath}`);
    
    try {
      const pomPath = path.join(checkPath, 'pom.xml');
      const gradlePath = path.join(checkPath, 'build.gradle');
      const applicationYmlPath = path.join(checkPath, 'src/main/resources/application.yml');
      const applicationPropsPath = path.join(checkPath, 'src/main/resources/application.properties');
      
      let hasJPA = false;
      let hasPostgreSQL = false;
      let hasValidation = false;
      let hasDataSourceConfig = false;

      // Check build file
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
      const srcPath = path.join(checkPath, 'src/main/java');
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
            content: content.slice(0, 1000)
          });
        }
      }
    } catch (error) {
      this.logger.debug(`Cannot access directory: ${dir}`);
    }
    return files;
  }
}