// pages/api/jobs-data.js
import { fetchClients } from '../../lib/clients';
import { getApolloJobs } from '../../lib/apollo-jobs';
import { scrapeCareerPage } from '../../lib/scraper-jobs';
import { daysAgo, dedupeJobs } from '../../lib/jobs-utils';

export const config = { api: { responseLimit: false } };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Module-level memory cache — persists across requests on same serverless instance
let memoryCache = null;
let memoryCacheTime = null;

function isCacheValid() {
  if (!memoryCache || !memoryCacheTime) return false;
  return Date.now() - memoryCacheTime < CACHE_TTL_MS;
}

// ── Redis helpers ─────────────────────────────────────────────────────────────
function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return (url && token) ? { url, token } : null;
}

async function readFromRedis() {
  const cfg = getRedisConfig();
  if (!cfg) return null;
  try {
    // Use command-array form (POST to root URL) — most reliable with Upstash REST.
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['GET', 'jobs_cache_v3']),
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

async function writeToRedis(value) {
  const cfg = getRedisConfig();
  if (!cfg) return;
  try {
    // Use command-array form so SET + EX is unambiguous and the value is stored
    // as a single JSON-encoded string (no double-stringify).
    const serialized = JSON.stringify(value);
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['SET', 'jobs_cache_v3', serialized, 'EX', 86400]),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('Redis SET failed', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Redis SET error', err);
  }
}

// ── Live fetch ────────────────────────────────────────────────────────────────
async function fetchLive() {
  const clients = await fetchClients();
  const results = [];

  for (const client of clients) {
    try {
      const [apolloResult, scrapeJobs] = await Promise.all([
        getApolloJobs(client.domain),
        scrapeCareerPage(client.domain, client.careersUrl),
      ]);

      const allJobs = dedupeJobs([...apolloResult.jobs, ...scrapeJobs])
        .sort((a, b) => {
          if (!a.postedAt && !b.postedAt) return 0;
          if (!a.postedAt) return 1;
          if (!b.postedAt) return -1;
          return new Date(b.postedAt) - new Date(a.postedAt);
        })
        .map(j => ({ ...j, postedAgo: daysAgo(j.postedAt) }));

      results.push({
        name: client.name,
        domain: client.domain,
        linkedinUrl: client.linkedinUrl,
        jobs: allJobs,
        totalJobs: allJobs.length,
        apolloJobs: apolloResult.jobs.length,
        scrapeJobs: scrapeJobs.length,
      });
    } catch (err) {
      results.push({ name: client.name, domain: client.domain, jobs: [], totalJobs: 0, error: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return { clients: results, fetchedAt: new Date().toISOString(), fromCache: false };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const forceRefresh = req.query.refresh === 'true';

  // 1. Memory cache (fastest)
  if (!forceRefresh && isCacheValid()) {
    return res.status(200).json({ ...memoryCache, fromCache: true });
  }

  // 2. Redis cache (survives across serverless instances)
  if (!forceRefresh) {
    const redisData = await readFromRedis();
    if (redisData) {
      memoryCache = redisData;
      memoryCacheTime = Date.now();
      return res.status(200).json({ ...redisData, fromCache: true });
    }
  }

  // 3. Live fetch
  try {
    const data = await fetchLive();
    memoryCache = data;
    memoryCacheTime = Date.now();
    await writeToRedis(data);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
