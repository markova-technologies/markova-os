class ToolInterface {
  async execute(toolDef, context) {
    throw new Error('Not implemented');
  }
}

module.exports = ToolInterface;
