const DEFAULT_TTL_MS = 60_000; // 60 seconds
const cacheStore = new Map();

export const getCachedAnalytics = (key) => {
  const entry = cacheStore.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value;
};

export const setCachedAnalytics = (key, value, ttlMs = DEFAULT_TTL_MS) => {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

export const invalidateAnalyticsCache = () => {
  cacheStore.clear();
};