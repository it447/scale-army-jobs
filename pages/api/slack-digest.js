// pages/api/slack-digest.js
// Posts a weekly digest of clients with job openings in the last 15 days to
// Slack. Intended to be invoked by a Vercel Cron Job every Tuesday. Reads the
// cached jobs data from Redis — the Monday cron is responsible for warming it.

import { readJobsCache } from '../../lib/jobs-cache';

const RECENT_DAYS = 15;
const JOBS_URL = 'https://scale-army-jobs-pox9.vercel.app/jobs?tab=recent';

function isRecent(dateStr) {
  if (!dateStr) return false;
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  return days <= RECENT_DAYS;
}

function buildMessage(recentClients, totalRecent) {
  if (totalRecent === 0) {
    return `:briefcase: *Daily Job Digest*\n\nNo openings posted across our monitored clients in the last ${RECENT_DAYS} days.\n\n<${JOBS_URL}|Open dashboard →>`;
  }

  const lines = recentClients
    .slice()
    .sort((a, b) => b.recentJobs.length - a.recentJobs.length)
    .map(c => `• *${c.name}* — ${c.recentJobs.length} role${c.recentJobs.length === 1 ? '' : 's'}`);

  return [
    `:briefcase: *Daily Job Digest*`,
    ``,
    `${recentClients.length} client${recentClients.length === 1 ? '' : 's'} with ${totalRecent} role${totalRecent === 1 ? '' : 's'} posted in the last ${RECENT_DAYS} days:`,
    ``,
    ...lines,
    ``,
    `<${JOBS_URL}|View all recent openings →>`,
  ].join('\n');
}

export default async function handler(req, res) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(500).json({ error: 'SLACK_WEBHOOK_URL env var is not set' });
  }

  const data = await readJobsCache();
  if (!data || !Array.isArray(data.clients)) {
    return res.status(503).json({
      error: 'No cached jobs data available. Warm the cache by hitting /api/jobs-data first.',
    });
  }

  const recentClients = data.clients
    .map(c => ({ ...c, recentJobs: (c.jobs || []).filter(j => isRecent(j.postedAt)) }))
    .filter(c => c.recentJobs.length > 0);

  const totalRecent = recentClients.reduce((sum, c) => sum + c.recentJobs.length, 0);
  const text = buildMessage(recentClients, totalRecent);

  try {
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!slackRes.ok) {
      const body = await slackRes.text().catch(() => '');
      return res.status(502).json({ error: `Slack webhook failed: ${slackRes.status} ${body}` });
    }
    return res.status(200).json({
      ok: true,
      companies: recentClients.length,
      totalRoles: totalRecent,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
