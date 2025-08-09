import path from 'path';
import fs from 'fs';

export class PostgreSQLTool {
  constructor(mcpService, fileService, logger, defaultProjectDirectory = null) {
    this.mcpService = mcpService;
    this.fileService = fileService;
    this.logger = logger;
    this.defaultProjectDirectory = defaultProjectDirectory || process.cwd();
  }

  getDefinition() {
    return {
      name: 'generate_postgresql_integration',
      description: 'Generate complete PostgreSQL integration for Spring Boot project',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to the project directory (defaults to current Cursor project)',
            default: '.'
          },
          description: {
            type: 'string',
            description: 'Description of what you want to build'
          },
          schema: {
            type: 'object',
            description: 'Database schema definition',
            properties: {
              tables: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { 
                      type: 'string',
                      description: 'Table name' 
                    },
                    fields: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          type: { type: 'string' },
                          length: { type: 'integer' },
                          primaryKey: { type: 'boolean' },
                          autoIncrement: { type: 'boolean' },
                          nullable: { type: 'boolean' },
                          unique: { type: 'boolean' },
                          defaultValue: { type: 'string' }
                        },
                        required: ['name', 'type']
                      }
                    }
                  },
                  required: ['name', 'fields']
                }
              }
            },
            required: ['tables']
          },
          preferences: {
            type: 'object',
            description: 'Generation preferences',
            properties: {
              useLombok: { 
                type: 'boolean', 
                default: true,
                description: 'Use Lombok annotations'
              },
              includeValidation: { 
                type: 'boolean', 
                default: true,
                description: 'Include validation annotations'
              },
              namingStrategy: {
                type: 'string',
                enum: ['snake_case', 'camelCase'],
                default: 'snake_case'
              },
              generateTests: {
                type: 'boolean',
                default: false
              },
              mergeStrategy: {
                type: 'string',
                enum: ['smart', 'append', 'replace'],
                default: 'smart',
                description: 'How to handle existing files'
              },
              removeProjectNameFromPath: {
                type: 'boolean',
                default: true,
                description: 'Remove project name from package paths'
              }
            }
          },
          applyToProject: {
            type: 'boolean',
            description: 'Automatically apply generated files to project',
            default: true
          }
        },
        required: ['description', 'schema']
      }
    };
  }

  async execute(args) {
    const { 
      projectPath, 
      description, 
      schema, 
      preferences = {}, 
      applyToProject = true 
    } = args;

    // CRITICAL: Use the project path that was already resolved in server.js
    // The projectPath should already be set to the Cursor working directory
    const resolvedProjectPath = projectPath || this.defaultProjectDirectory;
    
    this.logger.info('=== PostgreSQL Integration Tool Execution ===');
    this.logger.info(`Description: ${description}`);
    this.logger.info(`Tables: ${schema.tables.map(t => t.name).join(', ')}`);
    this.logger.info(`Project Path (received): ${projectPath}`);
    this.logger.info(`Project Path (resolved): ${resolvedProjectPath}`);
    this.logger.info(`Default Project Directory: ${this.defaultProjectDirectory}`);
    this.logger.info(`Apply to Project: ${applyToProject}`);

    // Verify the project path exists and contains a Spring Boot project
    try {
      const stats = await fs.promises.stat(resolvedProjectPath);
      if (!stats.isDirectory()) {
        throw new Error(`Project path is not a directory: ${resolvedProjectPath}`);
      }

      // Check for Spring Boot project markers
      const pomPath = path.join(resolvedProjectPath, 'pom.xml');
      const gradlePath = path.join(resolvedProjectPath, 'build.gradle');
      const srcPath = path.join(resolvedProjectPath, 'src', 'main', 'java');
      
      let isSpringBootProject = false;
      let buildFile = null;
      
      try {
        await fs.promises.access(pomPath);
        buildFile = 'pom.xml';
        isSpringBootProject = true;
      } catch {
        try {
          await fs.promises.access(gradlePath);
          buildFile = 'build.gradle';
          isSpringBootProject = true;
        } catch {
          this.logger.warn('No pom.xml or build.gradle found in project directory');
        }
      }
      
      if (isSpringBootProject) {
        this.logger.info(`✅ Found Spring Boot project with ${buildFile}`);
      } else {
        this.logger.warn('⚠️ Spring Boot project markers not found, continuing anyway...');
      }
      
      // Check if src/main/java exists
      try {
        await fs.promises.access(srcPath);
        this.logger.info('✅ Found src/main/java directory');
      } catch {
        this.logger.warn('⚠️ src/main/java directory not found - it will be created');
      }
      
    } catch (error) {
      this.logger.error(`Project path verification failed: ${error.message}`);
      throw new Error(`Invalid project path: ${resolvedProjectPath} - ${error.message}`);
    }

    // Update the file service with the correct project root
    this.fileService.setProjectRoot(resolvedProjectPath);
    this.fileService.setRemoveProjectNameFromPath(preferences.removeProjectNameFromPath !== false);

    try {
      // Phase 1: Create Plan
      this.logger.info('\n📋 Phase 1: Creating integration plan...');
      
      // Send the resolved project path to the MCP server
      const planResponse = await this.mcpService.createPlan({
        projectPath: resolvedProjectPath,
        description,
        preferences
      });

      this.logger.info(`✅ Plan created: ${planResponse.planId}`);
      this.logger.info(`   Status: ${planResponse.status}`);
      this.logger.info(`   Expires in: ${planResponse.expiresIn}`);

      // Phase 2: Execute Plan
      this.logger.info('\n🚀 Phase 2: Executing plan with schema...');
      
      const executionResponse = await this.mcpService.executePlan({
        planId: planResponse.planId,
        schema: schema
      });

      this.logger.info(`✅ Execution completed: ${executionResponse.executionId}`);
      this.logger.info(`   Status: ${executionResponse.status}`);
      this.logger.info(`   Files generated: ${executionResponse.summary.filesGenerated}`);
      this.logger.info(`   Total lines of code: ${executionResponse.summary.totalLinesOfCode}`);

      // Log the generated files
      if (executionResponse.generatedFiles) {
        this.logger.info('\n📁 Generated Files:');
        executionResponse.generatedFiles.forEach(category => {
          this.logger.info(`   ${category.category}:`);
          category.files.forEach(file => {
            this.logger.info(`     - ${file.path} (${file.action})`);
          });
        });
      }

      // Phase 3: Apply files if requested
      let filesApplied = 0;
      let appliedFiles = [];
      let applicationErrors = [];
      
      if (applyToProject && executionResponse.generatedFiles) {
        this.logger.info('\n📁 Phase 3: Applying files to project...');
        this.logger.info(`   Target directory: ${resolvedProjectPath}`);
        
        try {
          const result = await this.fileService.applyGeneratedFiles(
            executionResponse.generatedFiles
          );
          
          if (typeof result === 'object' && result.count !== undefined) {
            filesApplied = result.count;
            appliedFiles = result.files || [];
            applicationErrors = result.errors || [];
          } else {
            filesApplied = result;
          }
          
          this.logger.info(`✅ Applied ${filesApplied} files to project`);
          
          if (appliedFiles.length > 0) {
            this.logger.info('Applied files:');
            appliedFiles.forEach(file => {
              this.logger.info(`   ✅ ${file}`);
            });
          }
          
          if (applicationErrors.length > 0) {
            this.logger.warn('Some files could not be applied:');
            applicationErrors.forEach(error => {
              this.logger.warn(`   ⚠️ ${error}`);
            });
          }
        } catch (error) {
          this.logger.error('Failed to apply files:', error);
          this.logger.error('Error details:', error.stack);
          applicationErrors.push(error.message);
        }
      } else if (!applyToProject) {
        this.logger.info('\n📁 Phase 3: Skipping file application (applyToProject = false)');
      }

      // Return combined response
      const response = {
        content: [{
          type: 'text',
          text: this.formatCombinedResponse(
            planResponse, 
            executionResponse, 
            applyToProject, 
            filesApplied,
            appliedFiles,
            resolvedProjectPath,
            applicationErrors
          )
        }]
      };

      this.logger.info('\n✅ Tool execution completed successfully');
      return response;

    } catch (error) {
      this.logger.error('Integration failed:', error);
      this.logger.error('Error stack:', error.stack);
      
      return {
        content: [{
          type: 'text',
          text: this.formatErrorResponse(error, description, resolvedProjectPath)
        }]
      };
    }
  }

  formatCombinedResponse(planResponse, executionResponse, applyToProject, filesApplied, appliedFiles = [], projectPath, errors = []) {
    const summary = executionResponse.summary;
    const validation = executionResponse.validation || {};

    let response = `# 🎉 PostgreSQL Integration Completed Successfully!

## 📋 Plan Details
- **Plan ID:** \`${planResponse.planId}\`
- **Framework:** ${planResponse.projectAnalysis?.detectedFramework || 'Spring Boot'}
- **Base Package:** \`${planResponse.projectAnalysis?.basePackage || 'com.example'}\`
- **Project Path:** \`${projectPath}\`

## 📊 Execution Summary
- **Execution ID:** \`${executionResponse.executionId}\`
- **Tables Processed:** ${summary.tablesProcessed}
- **Files Generated:** ${summary.filesGenerated}
- **Files Modified:** ${summary.filesModified}
- **Dependencies Added:** ${summary.dependenciesAdded}
- **Total Lines of Code:** ${summary.totalLinesOfCode}
${applyToProject ? `- **Files Applied to Project:** ${filesApplied}/${summary.filesGenerated}` : '- **Files Applied:** Skipped (applyToProject = false)'}

## 📁 Generated Components

${executionResponse.generatedFiles?.map(category => 
  `### ${category.category}
${category.files?.map(file => {
  const applied = appliedFiles.some(f => f.includes(path.basename(file.path)));
  const status = applied ? '✅' : (applyToProject ? '⚠️' : '📄');
  return `- ${status} **${path.basename(file.path)}** (${file.size || 0} lines)
  - 📂 Path: \`${file.path}\`
  - 🔧 Action: ${file.action}`;
}).join('\n')}`
).join('\n\n') || 'No files information available'}

`;

    // Add applied files section if any
    if (appliedFiles.length > 0) {
      response += `## ✅ Successfully Applied Files\n\n`;
      appliedFiles.forEach(file => {
        response += `- ✅ ${file}\n`;
      });
      response += '\n';
    }

    // Add errors section if any
    if (errors.length > 0) {
      response += `## ⚠️ File Application Issues\n\n`;
      errors.forEach(error => {
        response += `- ❌ ${error}\n`;
      });
      response += '\n';
    }

    // Add validation section
    if (validation.compilationCheck || validation.dependencyCheck) {
      response += `## ✅ Quality Validation
- **Compilation Check:** ${validation.compilationCheck === 'passed' ? '✅' : '❌'} ${validation.compilationCheck || 'Not checked'}
- **Dependency Check:** ${validation.dependencyCheck === 'passed' ? '✅' : '❌'} ${validation.dependencyCheck || 'Not checked'}
- **Naming Conventions:** ${validation.namingConventions === 'passed' ? '✅' : '❌'} ${validation.namingConventions || 'Not checked'}
${validation.codeQuality ? `- **Code Quality Score:** ${validation.codeQuality.score}/100` : ''}

`;
    }

    // Add next steps
    response += `## 🚀 Next Steps

${executionResponse.postExecutionSteps?.map(step => 
  `${step.step}. **${step.action}**${step.required ? ' 🔴 (Required)' : ' 🟡 (Optional)'}
   ${step.description}`
).join('\n\n') || `1. **Update Database Configuration** 🔴 (Required)
   Configure your PostgreSQL connection in application.yml
   
2. **Run Database Migrations** 🔴 (Required)
   Create the database schema or let Hibernate auto-create it
   
3. **Restart Application** 🔴 (Required)
   Restart your Spring Boot application to load the new components`}

## 💡 Quick Start Commands

\`\`\`bash
# Update your database configuration in application.yml
# Then run your application:
mvn spring-boot:run

# Test the REST endpoints:
curl http://localhost:8080/api/${executionResponse.generatedFiles?.[0]?.files?.[0]?.path?.includes('users') ? 'users' : 'entities'}
\`\`\`

---
`;

    if (applyToProject) {
      if (filesApplied === summary.filesGenerated) {
        response += '✅ **All files have been successfully applied to your project!**';
      } else if (filesApplied > 0) {
        response += `⚠️ **${filesApplied} of ${summary.filesGenerated} files were applied. Check the errors above for details.**`;
      } else {
        response += '❌ **Files were generated but could not be applied. Check the file paths and permissions.**';
      }
    } else {
      response += '📋 **Files generated but not applied. Set applyToProject: true to auto-apply.**';
    }

    return response;
  }

  formatErrorResponse(error, description, projectPath) {
    return `# ❌ PostgreSQL Integration Failed

## 🚨 Error Details
- **Description:** ${description}
- **Project Path:** \`${projectPath}\`
- **Error:** ${error.message}

## 🔧 Troubleshooting Steps

1. **Verify Project Directory**
   - Ensure Cursor is opened in your Spring Boot project root
   - Check that the directory contains pom.xml or build.gradle
   - Current detected path: \`${projectPath}\`

2. **Check MCP Server Connection**
   - Ensure your Spring Boot MCP server is running on port 8080
   - Test: \`curl http://localhost:8080/mcp/health\`

3. **Review Project Structure**
   - Verify src/main/java directory exists
   - Check write permissions on the project directory

4. **Check Logs**
   - Review the MCP adapter logs for detailed error information
   - Check the Spring Boot server logs

## 🔄 Try Again
1. Ensure Cursor is opened in the correct project directory
2. Restart the MCP adapter
3. Try the integration again

---
💡 **Need help?** Check the logs for more details about what went wrong.`;
  }
}