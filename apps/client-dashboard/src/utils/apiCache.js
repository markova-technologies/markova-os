/**
 * Markova Client Dashboard — In-Memory API Cache
 * Prevents redundant HTTP fetches across route switches, tab changes, and repetitive UI loads.
 * Cache is partitioned by tenant/key and supports TTL-based expiration.
 */

class ApiCache {
  constructor(defaultTtlMs = 30000) {
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  _getKey(key) {
    let tenantId = 'public';
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      tenantId = user.company_id || user.companyId || 'default';
    } catch {
      // fallback
    }
    return `${tenantId}:${key}`;
  }

  get(key) {
    const fullKey = this._getKey(key);
    const entry = this.cache.get(fullKey);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    const fullKey = this._getKey(key);
    this.cache.set(fullKey, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  delete(key) {
    const fullKey = this._getKey(key);
    this.cache.delete(fullKey);
  }

  invalidate(prefix) {
    const tenantPrefix = this._getKey(prefix);
    for (const k of this.cache.keys()) {
      if (k.startsWith(tenantPrefix) || k.includes(prefix)) {
        this.cache.delete(k);
      }
    }
  }

  clear() {
    this.cache.clear();
  }

  async wrap(key, fetcherFn, ttlMs = this.defaultTtlMs) {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    const result = await fetcherFn();
    this.set(key, result, ttlMs);
    return result;
  }
}

export const apiCache = new ApiCache(30000);
export default apiCache;
