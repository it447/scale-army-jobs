// lib/apollo-jobs.js
// Fetches job postings from Apollo API for a given domain

const API_KEY = process.env.APOLLO_API_KEY;

export async function getApolloJobs(domain) {
  if (!API_KEY) return { jobs: [], orgId: null };

  // Step 1: Find org ID from domain
  const searchRes = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': API_KEY },
    body: JSON.stringify({ q_organization_domains_list: [domain], per_page: 1 }),
  });
  if (!searchRes.ok) return { jobs: [], orgId: null };
  const searchData = await searchRes.json();
  const orgId = searchData.organizations?.[0]?.id;
  if (!orgId) return { jobs: [], orgId: null };

  // Step 2: Get job postings
  const jobsRes = await fetch(`https://api.apollo.io/api/v1/organizations/${orgId}/job_postings?per_page=100`, {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': API_KEY },
  });
  if (!jobsRes.ok) return { jobs: [], orgId };
  const jobsData = await jobsRes.json();

  const jobs = (jobsData.organization_job_postings || []).map(j => ({
    id: `apollo_${j.id}`,
    title: j.title,
    location: [j.city, j.state, j.country].filter(Boolean).join(', ') || 'Not specified',
    postedAt: j.posted_at,
    url: j.url || null,
    source: 'Apollo',
  }));

  return { jobs, orgId };
}
