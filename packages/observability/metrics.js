class Metrics {
  static recordApiLatency(endpoint, latencyMs) {
    console.log(`[METRICS] api_latency: ${endpoint} ${latencyMs}ms`);
  }

  static recordLLMUsage(model, promptTokens, completionTokens, cost) {
    console.log(`[METRICS] llm_usage: ${model} p=${promptTokens} c=${completionTokens} cost=${cost}`);
  }
}

module.exports = Metrics;
