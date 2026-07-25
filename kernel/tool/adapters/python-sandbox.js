const ToolInterface = require('../interface');

class PythonSandboxTool extends ToolInterface {
  async execute(toolDef, context) {
    // Represents execution in a secure sandbox
    return {
      status: 'success',
      output: `Executed python script ${toolDef.name}`
    };
  }
}

module.exports = PythonSandboxTool;
