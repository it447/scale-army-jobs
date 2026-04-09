// lib/scraper-jobs.js
// Career page scraper using Playwright
// On Vercel this returns empty — Playwright only works in local/self-hosted environments

export async function scrapeCareerPage(domain, careersUrl) {
  // On Vercel serverless, skip scraping entirely — Apollo handles it
  if (process.env.VERCEL) return [];

  try {
    // Only runs locally where Playwright is installed
    const { chromium } = require('playwright');

    const urlsToTry = careersUrl
      ? [careersUrl]
      : [
          `https://${domain}/careers`,
          `https://${domain}/jobs`,
          `https://careers.${domain}`,
          `https://jobs.${domain}`,
        ];

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (compatible; ScaleArmyBot/1.0)',
    });

    let jobs = [];

    for (const url of urlsToTry) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
        jobs = await page.evaluate(() => {
          const results = [];
          const selectors = [
            '[class*="job"] a, [class*="position"] a, [class*="opening"] a',
            '.job-title a, .posting-title a',
            'li a[href*="job"], li a[href*="career"]',
          ];
          for (const selector of selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                elements.forEach(el => {
                  const title = el.textContent?.trim();
                  const href = el.href;
                  if (title && title.length > 3 && title.length < 200 && href) {
                    results.push({ title, url: href });
                  }
                });
                if (results.length > 0) break;
              }
            } catch {}
          }
          return results;
        });
        if (jobs.length > 0) break;
      } catch { continue; }
    }

    await browser.close();

    return jobs.slice(0, 50).map((j, i) => ({
      id: `scrape_${domain}_${i}`,
      title: j.title,
      location: 'See posting',
      postedAt: null,
      url: j.url,
      source: 'Career page',
    }));

  } catch {
    return [];
  }
}
