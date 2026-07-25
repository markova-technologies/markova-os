const SafetyFilter = require('./safety-filter');
const PIIDetector = require('./pii-detector');

class GuardrailPipeline {
  constructor(policyEngine) {
    this.policyEngine = policyEngine;
  }

  async runPreExecution(input, context) {
    // 1. Safety Filter
    const safetyResult = SafetyFilter.checkInput(input);
    if (!safetyResult.safe) {
      throw new Error(`Guardrail blocked input: ${safetyResult.reason}`);
    }

    // 2. Policy Engine checks (is this user allowed to run AI?)
    if (this.policyEngine) {
      this.policyEngine.assertCan(context, 'ai:execute');
    }

    // 3. PII Redaction
    const { redactedText, found } = PIIDetector.redact(input);
    
    return {
      safeInput: redactedText,
      metadata: { piiFound: found }
    };
  }

  async runPostExecution(output, context) {
    const safetyResult = SafetyFilter.checkOutput(output);
    if (!safetyResult.safe) {
      throw new Error(`Guardrail blocked output: ${safetyResult.reason}`);
    }

    const { redactedText } = PIIDetector.redact(output);
    
    return {
      safeOutput: redactedText
    };
  }
}

module.exports = GuardrailPipeline;
