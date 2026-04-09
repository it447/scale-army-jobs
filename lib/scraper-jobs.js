// lib/scraper-jobs.js
// Career page scraper — works locally with Playwright installed
// On Vercel (serverless) this gracefully returns empty and lets Apollo handle it

export async function scrapeCareerPage(domain, careersUrl) {
  try {
    // Dynamically import playwright — only works in environments where it's installed
    const playwright = await import('playwright').catch(() => null);
    if (!playwright) return []; // not available — skip silently

    const urlsToTry = careersUrl
      ? [careersUrl]
      : [
          `https://${domain}/careers`,
          `https://${domain}/jobs`,
          `https://careers.${domain}`,
          `https://jobs.${domain}`,
        ];

    const { chromium } = playwright;
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
    return [];
  }
}
