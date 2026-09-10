"""
Prometheus metrics definitions for the Markova Orchestrator.
Imported by main.py; gracefully degrades if prometheus_client is unavailable.
"""
try:
    from prometheus_client import (
        Counter,
        Histogram,
        Gauge,
        Summary,
        generate_latest,
        CONTENT_TYPE_LATEST,
        REGISTRY,
    )

    PROMETHEUS_AVAILABLE = True

    def _get_or_create_gauge(name, doc, labelnames=()):
        if name in REGISTRY._names_to_collectors:
            return REGISTRY._names_to_collectors[name]
        return Gauge(name, doc, labelnames=labelnames)

    def _get_or_create_counter(name, doc, labelnames=()):
        if name in REGISTRY._names_to_collectors:
            return REGISTRY._names_to_collectors[name]
        return Counter(name, doc, labelnames=labelnames)

    def _get_or_create_histogram(name, doc, labelnames=(), buckets=()):
        if name in REGISTRY._names_to_collectors:
            return REGISTRY._names_to_collectors[name]
        return Histogram(name, doc, labelnames=labelnames, buckets=buckets)

    def _get_or_create_summary(name, doc, labelnames=()):
        if name in REGISTRY._names_to_collectors:
            return REGISTRY._names_to_collectors[name]
        return Summary(name, doc, labelnames=labelnames)

    VOICE_CALLS_TOTAL = _get_or_create_counter(
        "markova_voice_calls_total",
        "Total inbound voice calls processed",
        labelnames=["company_id", "status"],
    )
    CALL_TURN_LATENCY = _get_or_create_histogram(
        "markova_call_turn_latency_seconds",
        "End-to-end voice turn processing latency",
        labelnames=["company_id"],
        buckets=(0.1, 0.25, 0.5, 1.0, 2.0, 5.0),
    )
    ACTIVE_CALLS = _get_or_create_gauge(
        "markova_active_calls",
        "Current active voice calls",
    )
    active_calls_gauge = ACTIVE_CALLS

    llm_tokens_total = _get_or_create_counter(
        "markova_llm_tokens_total",
        "Total LLM tokens consumed",
        labelnames=["company_id"],
    )
    turn_latency_summary = _get_or_create_summary(
        "markova_turn_latency_seconds",
        "End-to-end voice turn processing latency in seconds",
    )
    redis_operations_total = _get_or_create_counter(
        "markova_redis_ops_total",
        "Total Redis operations performed",
        labelnames=["op"],
    )

except ImportError:
    PROMETHEUS_AVAILABLE = False

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

    VOICE_CALLS_TOTAL = _Noop()
    CALL_TURN_LATENCY = _Noop()
    ACTIVE_CALLS = _Noop()
    active_calls_gauge = _Noop()
    llm_tokens_total = _Noop()
    turn_latency_summary = _Noop()
    redis_operations_total = _Noop()
    generate_latest = lambda: b""
    CONTENT_TYPE_LATEST = "text/plain"
