// lib/jobs-cache.js
// Shared Upstash Redis read/write helpers for the cached jobs data.
// Uses the command-array form of Upstash's REST API (POST to the root URL
// with a JSON array body), which is what the official @upstash/redis SDK
// uses internally — it handles SET + EX unambiguously.

const CACHE_KEY = 'jobs_cache_v3';
export const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return (url && token) ? { url, token } : null;
}

export async function readJobsCache() {
  const cfg = getRedisConfig();
  if (!cfg) return null;
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', CACHE_KEY]),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.result) return null;
    const parsed = JSON.parse(json.result);
    if (!parsed || !Array.isArray(parsed.clients)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeJobsCache(value) {
  const cfg = getRedisConfig();
  if (!cfg) return;
  try {
    const serialized = JSON.stringify(value);
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', CACHE_KEY, serialized, 'EX', CACHE_TTL_SECONDS]),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('Redis SET failed', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Redis SET error', err);
  }
}
