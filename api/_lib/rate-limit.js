import { error } from "./http.js";

export function consumeRateLimit(index, key, limit, windowMilliseconds, now = Date.now()) {
  index.rateLimits ??= {};
  const timestamps = (index.rateLimits[key] ?? []).filter(timestamp => Number.isFinite(timestamp) && timestamp > now - windowMilliseconds);
  if (timestamps.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((timestamps[0] + windowMilliseconds - now) / 1000));
    return { response: error(429, `Too many requests. Try again in ${retryAfterSeconds} seconds.`, { "retry-after": `${retryAfterSeconds}` }) };
  }
  timestamps.push(now);
  index.rateLimits[key] = timestamps;
  return { allowed: true };
}
