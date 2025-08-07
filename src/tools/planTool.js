export class PlanTool {
  constructor(mcpService, logger) {
    this.mcpService = mcpService;
    this.logger = logger;
  }

  getDefinition() {
    return {
      name: 'create_postgresql_integration_plan',
      description: 'Analyze project and create a plan for PostgreSQL integration',
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
            description: 'Description of the integration requirements'
          },
          preferences: {
            type: 'object',
            description: 'Integration preferences',
            properties: {
              useLombok: { type: 'boolean', default: true },
              includeValidation: { type: 'boolean', default: true },
              namingStrategy: { 
                type: 'string', 
                enum: ['snake_case', 'camelCase', 'PascalCase'],
                default: 'snake_case' 
              }
            }
          }
        },
        required: ['description']
      }
    };
  }

  async execute(args) {
    const { projectPath = '.', description, preferences = {} } = args;

    this.logger.info(`Creating integration plan for: ${description}`);

    const planData = await this.mcpService.createPlan({
      projectPath,
      description,
      preferences
    });

    return {
      content: [
        {
          type: 'text',
          text: this.formatPlanResponse(planData)
        }
      ]
    };
  }

  formatPlanResponse(planData) {
    return `# 🗂️ PostgreSQL Integration Plan Created

**Plan ID:** \`${planData.planId}\`
**Status:** ${planData.status}
**Expires in:** ${planData.expiresIn}

## 📊 Project Analysis
- **Framework:** ${planData.projectAnalysis?.detectedFramework}
- **Language:** ${planData.projectAnalysis?.language}
- **Build Tool:** ${planData.projectAnalysis?.buildTool}
- **Base Package:** \`${planData.projectAnalysis?.basePackage}\`

### 🏗️ Existing Structure
- **JPA:** ${planData.projectAnalysis?.existingStructure?.hasJPA ? '✅' : '❌'}
- **Database:** ${planData.projectAnalysis?.existingStructure?.hasDatabase ? '✅' : '❌'}
- **Lombok:** ${planData.projectAnalysis?.existingStructure?.hasLombok ? '✅' : '❌'}
- **Validation:** ${planData.projectAnalysis?.existingStructure?.hasValidation ? '✅' : '❌'}

## 🔄 Proposed Changes
${planData.proposedChanges?.summary}

### Components to Generate:
${planData.proposedChanges?.components?.map(comp => 
  `#### ${comp.type}
${comp.description}
${comp.items?.map(item => 
  `- **${item.name || item.component}**: ${item.purpose || item.description}`
).join('\n') || ''}`
).join('\n\n') || ''}

## 📈 Impact Assessment
- **Files to be created:** ${planData.impact?.filesCreated}
- **Files to be modified:** ${planData.impact?.filesModified}
- **Estimated lines of code:** ${planData.impact?.estimatedLinesOfCode}
- **Breaking changes:** ${planData.impact?.breakingChanges ? '⚠️ Yes' : '✅ No'}
- **Requires restart:** ${planData.impact?.requiresRestart ? '🔄 Yes' : '✅ No'}

## 🎯 Next Steps
${planData.nextSteps?.message}

**Required Input:** ${planData.nextSteps?.requiredInput?.description || 'Database schema definition'}

---
⚡ **Ready to execute!** Use this Plan ID for code generation: \`${planData.planId}\``;
  }
}