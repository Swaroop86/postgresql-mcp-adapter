// src/tools/postgresqlTool.js - Fixed version with proper file creation
import path from 'path';

export class PostgreSQLTool {
  constructor(mcpService, fileService, logger) {
    this.mcpService = mcpService;
    this.fileService = fileService;
    this.logger = logger;
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
            description: 'Path to the project directory',
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
      projectPath = '.', 
      description, 
      schema, 
      preferences = {}, 
      applyToProject = true 
    } = args;

    this.logger.info('=== PostgreSQL Integration Tool ===');
    this.logger.info(`Description: ${description}`);
    this.logger.info(`Tables: ${schema.tables.map(t => t.name).join(', ')}`);
    this.logger.info(`Apply to Project: ${applyToProject}`);

    try {
      // Phase 1: Create Plan
      this.logger.info('\n📋 Phase 1: Creating integration plan...');
      
      const planResponse = await this.mcpService.createPlan({
        projectPath,
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
      
      if (applyToProject && executionResponse.generatedFiles) {
        this.logger.info('\n📁 Phase 3: Applying files to project...');
        
        try {
          const result = await this.fileService.applyGeneratedFiles(
            executionResponse.generatedFiles
          );
          
          if (typeof result === 'object' && result.count !== undefined) {
            filesApplied = result.count;
            appliedFiles = result.files || [];
          } else {
            filesApplied = result;
          }
          
          this.logger.info(`✅ Applied ${filesApplied} files to project`);
          
          if (appliedFiles.length > 0) {
            this.logger.info('Applied files:');
            appliedFiles.forEach(file => {
              this.logger.info(`   - ${file}`);
            });
          }
        } catch (error) {
          this.logger.error('Failed to apply files:', error);
          this.logger.error('Error details:', error.stack);
          // Don't throw - continue with the response
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
            appliedFiles
          )
        }]
      };

      this.logger.info('\n✅ Tool execution completed successfully');
      this.logger.debug('Response:', JSON.stringify(response, null, 2));

      return response;

    } catch (error) {
      this.logger.error('Integration failed:', error);
      this.logger.error('Error stack:', error.stack);
      throw error;
    }
  }

  formatCombinedResponse(planResponse, executionResponse, applyToProject, filesApplied, appliedFiles = []) {
    const summary = executionResponse.summary;
    const validation = executionResponse.validation || {};

    let response = `# 🎉 PostgreSQL Integration Completed Successfully!

## 📋 Plan Details
- **Plan ID:** \`${planResponse.planId}\`
- **Framework:** ${planResponse.projectAnalysis?.detectedFramework || 'Spring Boot'}
- **Base Package:** \`${planResponse.projectAnalysis?.basePackage || 'com.example'}\`

## 📊 Execution Summary
- **Execution ID:** \`${executionResponse.executionId}\`
- **Tables Processed:** ${summary.tablesProcessed}
- **Files Generated:** ${summary.filesGenerated}
- **Files Modified:** ${summary.filesModified}
- **Dependencies Added:** ${summary.dependenciesAdded}
- **Total Lines of Code:** ${summary.totalLinesOfCode}
${applyToProject ? `- **Files Applied to Project:** ${filesApplied}` : '- **Files Applied:** Skipped (applyToProject = false)'}

## 📁 Generated Components

${executionResponse.generatedFiles?.map(category => 
  `### ${category.category}
${category.files?.map(file => 
  `- **${path.basename(file.path)}** (${file.size || 0} lines)
  - 📂 Path: \`${file.path}\`
  - 🔧 Action: ${file.action}`
).join('\n')}`
).join('\n\n') || 'No files information available'}

`;

    // Add applied files section if any
    if (appliedFiles.length > 0) {
      response += `## ✅ Applied Files\n\n`;
      appliedFiles.forEach(file => {
        response += `- ${file}\n`;
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
${applyToProject ? 
  (filesApplied > 0 ? 
    '✅ **All files have been applied to your project!**' : 
    '⚠️ **Files were generated but could not be applied. Check the file paths and permissions.**'
  ) : 
  '📋 **Files generated but not applied. Set applyToProject: true to auto-apply.**'}`;

    return response;
  }
}