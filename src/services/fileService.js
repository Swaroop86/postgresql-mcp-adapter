// src/services/fileService.js - Fixed to honor exact paths from MCP server
import fs from 'fs/promises';
import path from 'path';

export class FileService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.projectRoot = process.cwd(); // Default to current working directory
    this.backupDir = config.backupDir || '.mcp-backups';
    this.removeProjectNameFromPath = true; // Default to removing project name
  }

  // Method to set the project root explicitly
  setProjectRoot(projectRoot) {
    this.projectRoot = projectRoot;
    this.logger.info(`Project root set to: ${this.projectRoot}`);
  }

  // Method to control whether to remove project name from paths
  setRemoveProjectNameFromPath(remove) {
    this.removeProjectNameFromPath = remove;
    this.logger.info(`Remove project name from path: ${remove}`);
  }

  async mergeFileContent(existingContent, newContent, filePath, strategy = 'smart') {
    const ext = path.extname(filePath).toLowerCase();
    
    this.logger.info(`Merging content for ${filePath} using strategy: ${strategy}`);
    
    // For simple append strategy
    if (strategy === 'append') {
      return existingContent + '\n' + newContent;
    }
    
    // For replace strategy
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
        // For unknown file types, append with a separator
        return existingContent + '\n\n' + newContent;
    }
  }

  mergeJavaFile(existingContent, newContent) {
    // For Java files, we need to merge imports, annotations, and methods intelligently
    
    // Extract imports from both files
    const existingImports = this.extractJavaImports(existingContent);
    const newImports = this.extractJavaImports(newContent);
    
    // Merge imports (remove duplicates)
    const allImports = [...new Set([...existingImports, ...newImports])];
    
    // If we're adding to a controller/service, we might want to add methods
    if (existingContent.includes('@RestController') || existingContent.includes('@Service')) {
      // Extract the class body
      const classMatch = existingContent.match(/^([\s\S]*?)(}\s*)$/);
      if (classMatch) {
        const beforeClosingBrace = classMatch[1];
        const closingBrace = classMatch[2];
        
        // Extract methods from new content
        const newMethods = this.extractJavaMethods(newContent);
        
        // Build the merged content
        let merged = beforeClosingBrace;
        
        // Add new methods before the closing brace
        if (newMethods.length > 0) {
          merged += '\n\n    // Added by MCP integration\n';
          merged += newMethods.join('\n\n');
        }
        
        merged += closingBrace;
        
        // Update imports section
        return this.updateJavaImports(merged, allImports);
      }
    }
    
    // If we can't merge intelligently, append with a comment
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
    // Simple method extraction - looks for public/private/protected methods
    const methodRegex = /((?:@\w+(?:\([^)]*\))?\s*)*(?:public|private|protected)\s+[\w<>,\s]+\s+\w+\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{[^}]*\})/g;
    const methods = [];
    let match;
    
    while ((match = methodRegex.exec(content)) !== null) {
      methods.push('    ' + match[1].trim());
    }
    
    return methods;
  }

  updateJavaImports(content, imports) {
    // Find the package declaration
    const packageMatch = content.match(/package\s+[^;]+;/);
    if (!packageMatch) return content;
    
    const packageEnd = packageMatch.index + packageMatch[0].length;
    
    // Remove existing imports
    const withoutImports = content.replace(/\nimport\s+(?:static\s+)?[^;]+;/g, '');
    
    // Build new import section
    const importSection = imports.length > 0 ? '\n\n' + imports.join('\n') : '';
    
    // Insert imports after package declaration
    return withoutImports.slice(0, packageEnd) + importSection + withoutImports.slice(packageEnd);
  }

  mergePomXml(existingContent, newContent) {
    // For pom.xml, we typically want to add dependencies
    // This is a simple implementation - in practice, you'd want to use an XML parser
    
    if (newContent.includes('<dependency>')) {
      // Find the dependencies section
      const dependenciesMatch = existingContent.match(/<dependencies>([\s\S]*?)<\/dependencies>/);
      if (dependenciesMatch) {
        const existingDeps = dependenciesMatch[1];
        
        // Extract new dependencies
        const newDepsMatch = newContent.match(/<dependency>[\s\S]*?<\/dependency>/g);
        if (newDepsMatch) {
          // Add new dependencies before the closing tag
          const updatedDeps = existingDeps + '\n' + newDepsMatch.join('\n') + '\n    ';
          return existingContent.replace(
            /<dependencies>[\s\S]*?<\/dependencies>/,
            `<dependencies>${updatedDeps}</dependencies>`
          );
        }
      }
    }
    
    // If we can't merge intelligently, append
    return existingContent + '\n\n<!-- Added by MCP Integration -->\n' + newContent;
  }

  mergeXmlFile(existingContent, newContent) {
    // Generic XML merge - append with comment
    return existingContent + '\n\n<!-- Added by MCP Integration -->\n' + newContent;
  }

  mergeConfigFile(existingContent, newContent) {
    // For properties/yaml files, append new configurations
    // Add a separator comment
    const separator = existingContent.includes('=') ? 
      '\n\n# Added by MCP Integration\n' : 
      '\n\n# Added by MCP Integration\n';
    
    return existingContent + separator + newContent;
  }

  async applyGeneratedFiles(generatedFiles) {
    this.logger.info('Starting file application process...');
    this.logger.info(`Project root: ${this.projectRoot}`);
    
    // Verify project root exists and is a directory
    try {
      const stats = await fs.stat(this.projectRoot);
      if (!stats.isDirectory()) {
        throw new Error(`Project root is not a directory: ${this.projectRoot}`);
      }
    } catch (error) {
      this.logger.error(`Project root does not exist or is not accessible: ${this.projectRoot}`);
      throw error;
    }
    
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
          // Correct the file path if needed
          let correctedPath = file.path;
          let correctedContent = file.content;
          
          if (this.removeProjectNameFromPath && file.path.includes('/com/example/')) {
            // Pattern to match paths like: src/main/java/com/example/test_service/...
            const pathPattern = /^(.*\/com\/example\/)([^\/]+)\/(.*)/;
            const match = file.path.match(pathPattern);
            
            if (match) {
              const basePath = match[1];
              const middlePart = match[2];
              const restOfPath = match[3];
              
              // Check if the middle part looks like a project name
              if (middlePart.includes('_') || middlePart === middlePart.toLowerCase()) {
                correctedPath = basePath + restOfPath;
                this.logger.info(`Correcting path from: ${file.path} to: ${correctedPath}`);
                
                // Also fix package declarations and imports in Java files
                if (file.content && file.path.endsWith('.java')) {
                  correctedContent = file.content.replace(
                    new RegExp(`com\\.example\\.${middlePart}\\.`, 'g'),
                    'com.example.'
                  );
                  if (correctedContent !== file.content) {
                    this.logger.info('Corrected package declarations and imports in file content');
                  }
                }
              }
            }
          }
          
          this.logger.info(`\nProcessing file: ${correctedPath}`);
          this.logger.info(`Action: ${file.action}`);
          this.logger.info(`Content length: ${correctedContent ? correctedContent.length : 0} characters`);
          
          // Use the corrected file path
          const fullPath = path.resolve(this.projectRoot, correctedPath);
          this.logger.info(`Full path: ${fullPath}`);
          
          // Verify the path is within the project root (security check)
          const normalizedFullPath = path.normalize(fullPath);
          const normalizedProjectRoot = path.normalize(this.projectRoot);
          if (!normalizedFullPath.startsWith(normalizedProjectRoot)) {
            throw new Error(`Security error: File path ${correctedPath} would be written outside project root`);
          }
          
          // Create directory if it doesn't exist
          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });
          this.logger.info(`Directory ensured: ${dir}`);
          
          // Check if directory is writable
          try {
            await fs.access(dir, fs.constants.W_OK);
            this.logger.debug(`✅ Directory exists and is writable: ${dir}`);
          } catch (accessError) {
            throw new Error(`Directory is not writable: ${dir}`);
          }

          if (file.action === 'create' || file.action === 'modify' || file.action === 'append') {
            // Backup existing file if it exists and backup is enabled
            if (this.config.autoBackup) {
              await this.createBackup(fullPath, correctedPath);
            }

            // Validate content
            if (!correctedContent) {
              this.logger.warn(`No content for file: ${correctedPath}, skipping`);
              continue;
            }

            // Handle different actions
            if (file.action === 'create') {
              // For create action, write the file (overwrite if exists)
              await fs.writeFile(fullPath, correctedContent, 'utf8');
              this.logger.info(`✅ Created: ${correctedPath}`);
            } else if (file.action === 'append') {
              // For append action, add content to the end of the file
              await fs.appendFile(fullPath, correctedContent, 'utf8');
              this.logger.info(`✅ Appended to: ${correctedPath}`);
            } else if (file.action === 'modify') {
              // For modify action, we need to be smarter about how we handle it
              let fileExists = false;
              let existingContent = '';
              
              try {
                existingContent = await fs.readFile(fullPath, 'utf8');
                fileExists = true;
              } catch (error) {
                // File doesn't exist, treat as create
                fileExists = false;
              }

              if (!fileExists) {
                // File doesn't exist, create it
                await fs.writeFile(fullPath, correctedContent, 'utf8');
                this.logger.info(`✅ Created (was modify): ${correctedPath}`);
              } else {
                // File exists, we need to merge or append based on file type
                const mergedContent = await this.mergeFileContent(
                  existingContent, 
                  correctedContent, 
                  correctedPath,
                  file.mergeStrategy || 'smart'
                );
                await fs.writeFile(fullPath, mergedContent, 'utf8');
                this.logger.info(`✅ Modified: ${correctedPath}`);
              }
            }
            
            filesApplied++;
            appliedFilesList.push(correctedPath);
            
            // Verify file was written
            const stats = await fs.stat(fullPath);
            this.logger.debug(`File size: ${stats.size} bytes`);
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
    this.logger.info(`Project root: ${this.projectRoot}`);
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
      const backupPath = path.join(this.projectRoot, this.backupDir, backupFileName);
      
      // Ensure backup directory exists
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

  async checkIntegrationStatus(projectPath) {
    try {
      // Use the provided project path or fall back to the configured project root
      const checkPath = projectPath || this.projectRoot;
      this.logger.info(`Checking integration status for: ${checkPath}`);
      
      // Check for PostgreSQL integration components
      const pomPath = path.join(checkPath, 'pom.xml');
      const gradlePath = path.join(checkPath, 'build.gradle');
      const applicationYmlPath = path.join(checkPath, 'src/main/resources/application.yml');
      const applicationPropsPath = path.join(checkPath, 'src/main/resources/application.properties');
      
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