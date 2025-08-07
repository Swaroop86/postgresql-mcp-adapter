export class StatusTool {
  constructor(fileService, logger) {
    this.fileService = fileService;
    this.logger = logger;
  }

  getDefinition() {
    return {
      name: 'get_postgresql_integration_status',
      description: 'Check the status of PostgreSQL integration in the current project',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Path to check',
            default: '.'
          }
        }
      }
    };
  }

  async execute(args) {
    const { projectPath = '.' } = args;

    this.logger.info(`Checking integration status for: ${projectPath}`);

    const status = await this.fileService.checkIntegrationStatus(projectPath);

    return {
      content: [
        {
          type: 'text',
          text: this.formatStatusResponse(status, projectPath)
        }
      ]
    };
  }

  formatStatusResponse(status, projectPath) {
    return `# 🔍 PostgreSQL Integration Status

## Overall Status: ${status.configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}

## 🧩 Component Status
- **Dependencies:** ${status.components.dependencies ? '✅' : '❌'} JPA and PostgreSQL dependencies
- **Configuration:** ${status.components.configuration ? '✅' : '❌'} Database connection configuration
- **Entities:** ${status.components.entities ? '✅' : '❌'} JPA entity classes
- **Repositories:** ${status.components.repositories ? '✅' : '❌'} Spring Data repositories
- **Services:** ${status.components.services ? '✅' : '❌'} Service layer
- **Controllers:** ${status.components.controllers ? '✅' : '❌'} REST controllers

## 💡 Recommendations
${this.generateRecommendations(status)}

---
📂 *Project Path: ${projectPath}*`;
  }

  generateRecommendations(status) {
    const recommendations = [];

    if (!status.components.dependencies) {
      recommendations.push('- 📦 Add PostgreSQL dependencies using the integration plan');
    }
    if (!status.components.configuration) {
      recommendations.push('- ⚙️ Configure database connection in application.yml');
    }
    if (!status.components.entities) {
      recommendations.push('- 🏗️ Generate entity classes for your database tables');
    }
    if (!status.configured) {
      recommendations.push('- 🚀 Run PostgreSQL integration to set up missing components');
    }

    if (recommendations.length === 0) {
      return '✅ PostgreSQL integration is complete! No further action needed.';
    }

    return recommendations.join('\n');
  }
}