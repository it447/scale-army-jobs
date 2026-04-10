// pages/api/jobs-data.js
// Returns job postings for all clients — cached once per day via Vercel KV
// If KV is not set up, falls back to live fetch every time

import { fetchClients } from '../../lib/clients';
import { getApolloJobs } from '../../lib/apollo-jobs';
import { scrapeCareerPage } from '../../lib/scraper-jobs';
import { daysAgo, dedupeJobs } from '../../lib/jobs-utils';

export const config = { api: { responseLimit: false } };

const CACHE_KEY = 'jobs_cache_v2';
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// ── KV helpers (gracefully skipped if KV not configured) ─────────────────────
async function readCache() {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return null;

    const res = await fetch(`${url}/get/${CACHE_KEY}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.result) return null;

    // Parse — handle double-stringified values
    let parsed = data.result;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);

    // Validate the cache has the expected shape
    if (!parsed || !Array.isArray(parsed.clients)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(value) {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) return;

    // Store as single-stringified JSON
    const body = { value: JSON.stringify(value) };
    await fetch(`${url}/set/${CACHE_KEY}?ex=${CACHE_TTL_SECONDS}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    // silent fail
  }
}

// ── Live fetch from Apollo + scraper ─────────────────────────────────────────
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

  return {
    clients: results,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Allow force-refresh via ?refresh=true (for the Refresh button)
  const forceRefresh = req.query.refresh === 'true';

  try {
    // Try to read from cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await readCache();
      if (cached) {
        return res.status(200).json({ ...cached, fromCache: true });
      }
    }

    // Cache miss or force refresh — fetch live data
    const data = await fetchLive();

    // Save to cache for next visit
    await writeCache(data);

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
