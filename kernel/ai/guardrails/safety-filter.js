class SafetyFilter {
  static INJECTION_PATTERNS = [
    /ignore previous instructions/i,
    /you are now/i,
    /bypass security/i,
    /system prompt:/i
  ];

  static checkInput(text) {
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return { safe: false, reason: 'Potential prompt injection detected', matched: pattern.toString() };
      }
    }
    return { safe: true };
  }

  static checkOutput(text) {
    // Check for hallucinations or profanity
    // In a real system, this might call a fast local ML model or regex
    return { safe: true };
  }
}

module.exports = SafetyFilter;
