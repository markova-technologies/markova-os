"""
Prometheus metrics definitions for the Markova Orchestrator.
Imported by main.py; gracefully degrades if prometheus_client is unavailable.
"""
try:
    from prometheus_client import Counter, Histogram, Gauge, Summary

    active_calls_gauge = Gauge(
        "markova_active_calls",
        "Current number of active voice calls"
    )
    llm_tokens_total = Counter(
        "markova_llm_tokens_total",
        "Total LLM tokens consumed",
        ["company_id"]
    )
    turn_latency_summary = Summary(
        "markova_turn_latency_seconds",
        "End-to-end voice turn processing latency in seconds"
    )
    redis_operations_total = Counter(
        "markova_redis_ops_total",
        "Total Redis operations performed",
        ["op"]
    )

except ImportError:
    # No-op stubs so the orchestrator starts cleanly without prometheus_client
    class _Noop:
        def labels(self, **kw):
            return self
        def inc(self, *a, **kw):
            pass
        def dec(self, *a, **kw):
            pass
        def observe(self, *a, **kw):
            pass
        def set(self, *a, **kw):
            pass

    active_calls_gauge = _Noop()
    llm_tokens_total = _Noop()
    turn_latency_summary = _Noop()
    redis_operations_total = _Noop()
