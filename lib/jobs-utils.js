// lib/jobs-utils.js
// Shared utilities for job data

export function daysAgo(dateStr) {
  if (!dateStr) return null;
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// Deduplicate jobs by title (case-insensitive) preferring Apollo source
export function dedupeJobs(jobs) {
  const seen = new Map();
  jobs.forEach(j => {
    const key = j.title.toLowerCase().trim();
    if (!seen.has(key) || j.source === 'Apollo') {
      seen.set(key, j);
    }
  });
  return Array.from(seen.values());
}
