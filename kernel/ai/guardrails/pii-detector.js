class PIIDetector {
  static PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b(?:\d[ -]*?){13,16}\b/g
  };

  static redact(text, modes = { email: 'REDACT', ssn: 'REDACT', creditCard: 'REDACT' }) {
    let redactedText = text;
    let found = [];

    for (const [type, pattern] of Object.entries(this.PII_PATTERNS)) {
      if (modes[type] === 'BLOCK' && pattern.test(text)) {
        throw new Error(`Blocked: PII of type ${type} detected.`);
      }

      if (modes[type] === 'REDACT') {
        const matches = redactedText.match(pattern);
        if (matches) {
          found.push({ type, count: matches.length });
          redactedText = redactedText.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
        }
      }
    }

    return { redactedText, found };
  }
}

module.exports = PIIDetector;
