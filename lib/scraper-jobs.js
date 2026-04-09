// lib/scraper-jobs.js
// Scrapes company careers pages using Playwright headless browser
// Falls back gracefully if Playwright is not available

export async function scrapeCareerPage(domain, careersUrl) {
  // Build the careers URL to try
  const urlsToTry = careersUrl
    ? [careersUrl]
    : [
        `https://${domain}/careers`,
        `https://${domain}/jobs`,
        `https://careers.${domain}`,
        `https://jobs.${domain}`,
      ];

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (compatible; ScaleArmyBot/1.0)' });

    let jobs = [];

    for (const url of urlsToTry) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

        // Generic job extraction — looks for common patterns across career pages
        jobs = await page.evaluate(() => {
          const results = [];

          // Common selectors used by Greenhouse, Lever, Workable, and custom pages
          const selectors = [
            '[class*="job"] a, [class*="position"] a, [class*="opening"] a, [class*="role"] a',
            '[data-job] a, [data-position] a',
            '.job-title a, .posting-title a, .opportunity-title a',
            'li a[href*="job"], li a[href*="career"], li a[href*="position"]',
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
      } catch {
        continue;
      }
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
    // Playwright not available or scrape failed — return empty
    return [];
  }
}
