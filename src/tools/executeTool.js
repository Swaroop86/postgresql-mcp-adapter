import path from 'path';

export class ExecuteTool {
  constructor(mcpService, fileService, logger) {
    this.mcpService = mcpService;
    this.fileService = fileService;
    this.logger = logger;
  }

  getDefinition() {
    return {
      name: 'execute_postgresql_integration',
      description: 'Generate and apply PostgreSQL integration code based on database schema',
      inputSchema: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            description: 'Plan ID from create_postgresql_integration_plan'
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
                    name: { type: 'string' },
                    fields: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          type: { type: 'string' },
                          length: { type: 'integer' },
                          primaryKey: { type: 'boolean', default: false },
                          autoIncrement: { type: 'boolean', default: false },
                          nullable: { type: 'boolean', default: true },
                          unique: { type: 'boolean', default: false },
                          defaultValue: { type: 'string' },
                          foreignKey: {
                            type: 'object',
                            properties: {
                              table: { type: 'string' },
                              column: { type: 'string' },
                              onDelete: { type: 'string', default: 'CASCADE' }
                            }
                          }
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
          applyToProject: {
            type: 'boolean',
            description: 'Whether to automatically apply generated files to the project',
            default: true
          }
        },
        required: ['planId', 'schema']
      }
    };
  }

  async execute(args) {
    const { planId, schema, applyToProject = true } = args;

    this.logger.info(`Executing plan: ${planId} with ${schema.tables?.length} tables`);

    const executionData = await this.mcpService.executePlan({
      planId,
      schema,
      applyToProject
    });

    if (executionData.status === 'error') {
      throw new Error(`Plan execution failed: ${executionData.error?.message || 'Unknown error'}`);
    }

    // Apply files to project if requested
    let filesApplied = 0;
    if (applyToProject) {
      filesApplied = await this.fileService.applyGeneratedFiles(
        executionData.generatedFiles
      );
    }

    return {
      content: [
        {
          type: 'text',
          text: this.formatExecutionResponse(executionData, applyToProject, filesApplied)
        }
      ]
    };
  }

  formatExecutionResponse(executionData, applyToProject, filesApplied) {
    const summary = executionData.summary;
    const validation = executionData.validation;

    return `# 🎉 PostgreSQL Integration Completed Successfully!

## 📊 Execution Summary
- **Execution ID:** \`${executionData.executionId}\`
- **Tables Processed:** ${summary.tablesProcessed}
- **Files Generated:** ${summary.filesGenerated}
- **Files Modified:** ${summary.filesModified}
- **Dependencies Added:** ${summary.dependenciesAdded}
- **Total Lines of Code:** ${summary.totalLinesOfCode}
${applyToProject ? `- **Files Applied to Project:** ${filesApplied}` : ''}

## 📁 Generated Components

${executionData.generatedFiles?.map(category => 
  `### ${category.category}
${category.files?.map(file => 
  `- **${path.basename(file.path)}** (${file.size} lines)
  - 📂 Path: \`${file.path}\`
  - 🔧 Action: ${file.action}${file.action === 'modify' ? `
  - 📝 Changes: ${this.formatChanges(file.changes)}` : ''}`
).join('\n') || ''}`
).join('\n\n') || ''}

## ✅ Quality Validation
- **Compilation Check:** ${validation.compilationCheck === 'passed' ? '✅' : '❌'} ${validation.compilationCheck}
- **Dependency Check:** ${validation.dependencyCheck === 'passed' ? '✅' : '❌'} ${validation.dependencyCheck}
- **Naming Conventions:** ${validation.namingConventions === 'passed' ? '✅' : '❌'} ${validation.namingConventions}
- **Code Quality Score:** ${validation.codeQuality?.score}/100 ${this.getScoreEmoji(validation.codeQuality?.score)}

## 🚀 Next Steps Required

${executionData.postExecutionSteps?.map(step => 
  `${step.step}. **${step.action}**${step.required ? ' 🔴 (Required)' : ' 🟡 (Optional)'}
   ${step.description}${step.resource ? `
   📖 **Resource:** ${step.resource}` : ''}`
).join('\n\n') || ''}

---
${applyToProject ? 
'🎯 **Files have been automatically applied to your project!**' : 
'📋 **Files are generated but not applied. Set \`applyToProject: true\` to auto-apply.**'}

⏱️ *Execution Time: ${executionData.metadata?.executionTime}*`;
  }

  formatChanges(changes) {
    if (!changes) return '';
    
    if (changes.added && Array.isArray(changes.added)) {
      return changes.added.join(', ');
    }
    
    return JSON.stringify(changes);
  }

  getScoreEmoji(score) {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    return '🔴';
  }
}