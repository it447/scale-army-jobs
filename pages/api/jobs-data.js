// pages/api/jobs-data.js
// Returns all current job postings for every client — Apollo + career page scraper combined

import { fetchClients } from '../../lib/clients';
import { getApolloJobs } from '../../lib/apollo-jobs';
import { scrapeCareerPage } from '../../lib/scraper-jobs';
import { daysAgo, dedupeJobs } from '../../lib/jobs-utils';

export const config = { api: { responseLimit: false } };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const clients = await fetchClients();
    const results = [];

    for (const client of clients) {
      try {
        // Run Apollo + scraper in parallel for each client
        const [apolloResult, scrapeJobs] = await Promise.all([
          getApolloJobs(client.domain),
          scrapeCareerPage(client.domain, client.careersUrl),
        ]);

        // Combine, dedupe, and sort by date
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
        results.push({ name: client.name, domain: client.domain, jobs: [], error: err.message });
      }

      await new Promise(r => setTimeout(r, 300));
    }

    return res.status(200).json({
      success: true,
      clients: results,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
