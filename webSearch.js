/**
 * webSearch.js — Live web search using DuckDuckGo + cheerio
 * No API key required. Falls back gracefully if blocked.
 */
const https = require('https');
const cheerio = require('cheerio');

function fetchHTML(url, options = {}) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity',
        'Connection': 'close',
        ...options.headers
      }
    };
    const req = https.request(reqOptions, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://${parsedUrl.hostname}${res.headers.location}`;
        return fetchHTML(nextUrl, options).then(resolve);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(10000, () => { req.destroy(); resolve(''); });
    req.end();
  });
}

/**
 * Search DuckDuckGo and return top result snippets
 */
async function searchWeb(query, numResults = 5) {
  try {
    const encoded = encodeURIComponent(query);
    const html = await fetchHTML(`https://html.duckduckgo.com/html/?q=${encoded}`);
    if (!html) return [];

    const $ = cheerio.load(html);
    const results = [];

    $('.result__body').each((i, el) => {
      if (i >= numResults) return false;
      const title = $(el).find('.result__title a').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const href = $(el).find('.result__title a').attr('href') || '';
      // DuckDuckGo wraps URLs — extract the real URL from uddg param
      let url = href;
      try {
        const u = new URL('https://duckduckgo.com' + href);
        url = u.searchParams.get('uddg') || href;
      } catch (e) {}
      if (title) results.push({ title, snippet, url });
    });

    return results;
  } catch (e) {
    return [];
  }
}

/**
 * Fetch and extract clean text from a web page
 */
async function fetchPageText(url, maxChars = 2000) {
  try {
    const html = await fetchHTML(url);
    if (!html) return '';
    const $ = cheerio.load(html);
    // Remove noise elements
    $('script, style, nav, header, footer, iframe, noscript, aside, .nav, .menu, .cookie, .ad, [class*="cookie"], [class*="banner"], [id*="banner"]').remove();
    // Get main content area if possible
    const main = $('main, article, [role="main"], .content, #content, .post, .article').first();
    const text = (main.length ? main : $('body')).text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, maxChars);
    return text;
  } catch (e) {
    return '';
  }
}

/**
 * Comprehensive company research — returns structured context for LLM
 */
async function researchCompany(company, role = '') {
  const queries = [
    `${company} company overview funding employees 2024 2025`,
    `${company} ${role || 'engineering'} tech stack engineering blog`,
    `${company} latest news funding announcement 2024 2025`,
  ];

  const allResults = [];
  const sources = [];

  for (const q of queries) {
    const results = await searchWeb(q, 4);
    allResults.push(...results);
    results.forEach(r => {
      if (r.url && !sources.includes(r.url)) sources.push(r.url);
    });
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Fetch content from top 3 most relevant pages
  const topUrls = unique
    .filter(r => r.url && r.url.startsWith('http'))
    .slice(0, 3)
    .map(r => r.url);

  const pageTexts = await Promise.all(topUrls.map(url => fetchPageText(url, 1500).catch(() => '')));

  const context = [
    '=== LIVE WEB SEARCH RESULTS ===',
    ...unique.slice(0, 8).map(r => `• ${r.title}\n  ${r.snippet}\n  Source: ${r.url}`),
    '',
    '=== PAGE CONTENT (live) ===',
    ...pageTexts.filter(Boolean).map((text, i) => `[${topUrls[i]}]\n${text}`),
  ].join('\n');

  return { context, sources: unique.slice(0, 8).map(r => ({ title: r.title, url: r.url, snippet: r.snippet })) };
}

module.exports = { searchWeb, fetchPageText, researchCompany };
