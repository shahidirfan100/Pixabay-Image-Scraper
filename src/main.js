// Pixabay Image Scraper - API-based via Patchright Chrome (Cloudflare bypass)
// Pattern C: launchPersistentContext with real Chrome for maximum Cloudflare bypass
import { Actor, Dataset, log } from 'apify';
import { chromium } from 'patchright';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';

await Actor.init();

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            keyword = '',
            url = '',
            startUrl = '',
            results_wanted: RESULTS_WANTED_RAW = 20,
            max_pages: MAX_PAGES_RAW = 999,
            proxyConfiguration,
        } = input;

        const RESULTS_WANTED = Number.isFinite(+RESULTS_WANTED_RAW) ? Math.max(1, +RESULTS_WANTED_RAW) : Number.MAX_SAFE_INTEGER;
        const MAX_PAGES = Number.isFinite(+MAX_PAGES_RAW) ? Math.max(1, +MAX_PAGES_RAW) : 999;

        // Proxy setup
        const isApifyCloud = Actor.isAtHome();
        const shouldUseApifyProxy = Boolean(proxyConfiguration?.useApifyProxy);
        const hasCustomProxyUrls = Array.isArray(proxyConfiguration?.proxyUrls) && proxyConfiguration.proxyUrls.length > 0;

        let proxyConf;
        if (proxyConfiguration && (hasCustomProxyUrls || (shouldUseApifyProxy && isApifyCloud))) {
            proxyConf = await Actor.createProxyConfiguration({ ...proxyConfiguration });
        } else if (shouldUseApifyProxy && !isApifyCloud) {
            log.info('Local run detected: ignoring Apify Proxy setting and running without proxy.');
        }

        const browserProxyUrl = proxyConf ? await proxyConf.newUrl() : undefined;

        let saved = 0;

        // Build search URL from keyword or use provided URL
        function buildSearchUrl(kw) {
            const base = 'https://pixabay.com/images/search/';
            if (kw) return `${base}${encodeURIComponent(String(kw).trim().replace(/\s+/g, '-'))}/`;
            return base;
        }

        function getInitialUrl() {
            if (startUrl) return normalizeUrl(startUrl);
            if (url) return normalizeUrl(url);
            if (keyword) return buildSearchUrl(keyword);
            return 'https://pixabay.com/images/search/';
        }

        function normalizeUrl(u) {
            try {
                const parsed = new URL(u);
                if (!parsed.hostname.includes('pixabay.com')) {
                    log.warning(`URL ${u} is not a Pixabay URL, will try to extract keyword`);
                    return buildSearchUrl(keyword);
                }
                if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
                parsed.searchParams.delete('pagi');
                return parsed.href;
            } catch {
                return buildSearchUrl(u);
            }
        }

        function buildNextPageUrl(baseUrl, pageNum) {
            try {
                const parsed = new URL(baseUrl);
                parsed.searchParams.set('pagi', String(pageNum));
                return parsed.href;
            } catch {
                return `${baseUrl}?pagi=${pageNum}`;
            }
        }

        // Extract clean image data from bootstrap API response (no null values)
        function extractImageData(item) {
            const sources = item.sources || {};
            const tagList = Array.isArray(item.tagList)
                ? item.tagList.map(t => (Array.isArray(t) ? t[0] : t)).filter(Boolean)
                : [];
            const user = item.user || {};

            const data = {};

            if (item.id) data.id = item.id;
            if (item.name) data.title = item.name;
            if (item.mediaType) data.mediaType = item.mediaType;
            if (item.width) data.width = item.width;
            if (item.height) data.height = item.height;

            if (sources['1x']) data.imageUrl_small = sources['1x'];
            if (sources['2x']) data.imageUrl_large = sources['2x'];
            if (sources.downloadUrl) data.downloadUrl = `https://pixabay.com${sources.downloadUrl}`;

            if (tagList.length > 0) data.tags = tagList.join(', ');

            if (item.likeCount != null && item.likeCount > 0) data.likes = item.likeCount;
            if (item.commentCount != null && item.commentCount > 0) data.comments = item.commentCount;
            if (item.viewCount != null && item.viewCount > 0) data.views = item.viewCount;
            if (item.downloadCount != null && item.downloadCount > 0) data.downloads = item.downloadCount;

            if (item.isEditorsChoice === true) data.editorsChoice = true;
            if (item.isAiGenerated === true) data.aiGenerated = true;
            if (item.nsfw === true) data.nsfw = true;

            if (item.uploadDate) data.uploadDate = item.uploadDate;

            if (user.username) data.username = user.username;
            if (user.profileUrl) data.profileUrl = `https://pixabay.com${user.profileUrl}`;

            if (item.id) data.pageUrl = `https://pixabay.com/photos/${item.id}/`;

            return data;
        }

        /**
         * Fetch bootstrap JSON by navigating the page directly to the bootstrap URL.
         * This is the most reliable method because:
         * - The full patchright stealth context (cookies, headers, TLS) is preserved
         * - No internal fetch() needed — browser navigation handles authentication
         * - Works for page 2, 3, N+ because session cookies from page 1 carry over
         */
        async function fetchBootstrapByNavigation(page, bootstrapUrl, refererUrl) {
            const fullUrl = bootstrapUrl.startsWith('http')
                ? bootstrapUrl
                : `https://pixabay.com${bootstrapUrl.startsWith('/') ? '' : '/'}${bootstrapUrl}`;

            log.info(`Navigating to bootstrap API URL: ${fullUrl}`);
            try {
                const response = await page.goto(fullUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000,
                    referer: refererUrl,
                });

                if (!response || !response.ok()) {
                    log.warning(`Bootstrap navigation returned status: ${response?.status()}`);
                    return null;
                }

                const bodyText = await page.evaluate(() => document.body.innerText);
                if (!bodyText) return null;

                try {
                    return JSON.parse(bodyText);
                } catch {
                    // Sometimes the JSON is in a <pre> tag
                    const preText = await page.evaluate(() => {
                        const pre = document.querySelector('pre');
                        return pre ? pre.innerText : document.body.innerText;
                    });
                    return JSON.parse(preText);
                }
            } catch (err) {
                log.warning(`Bootstrap navigation failed: ${err.message}`);
                return null;
            }
        }

        /**
         * Extract bootstrap URL from a Pixabay search page.
         * Returns { bootstrapUrl, pageUrl } — the caller must navigate back to pageUrl after fetching.
         */
        async function getBootstrapUrlFromPage(page) {
            // Try window object first
            try {
                const fromWindow = await page.evaluate(() => window.__BOOTSTRAP_URL__ || null);
                if (fromWindow) return fromWindow;
            } catch { /* ignore */ }

            // Fallback: parse from HTML
            try {
                const html = await page.content();
                const match = html.match(/__BOOTSTRAP_URL__\s*=\s*["']([^"']+)["']/);
                if (match) {
                    log.info(`Parsed __BOOTSTRAP_URL__ from HTML: ${match[1]}`);
                    return match[1];
                }
            } catch { /* ignore */ }

            return null;
        }

        const startSearchUrl = getInitialUrl();
        log.info(`Starting Pixabay image scraper: ${startSearchUrl}`);
        log.info(`Target: ${RESULTS_WANTED} images, max ${MAX_PAGES} pages`);

        // Pattern C: launchPersistentContext with real Chrome — best for Cloudflare bypass
        // DO NOT add userAgent or extraHTTPHeaders — patchright manages fingerprinting internally
        // Use os.tmpdir() for user data — always writable including under Apify LIMITED_PERMISSIONS
        const userDataDir = path.join(os.tmpdir(), `pixabay-chrome-${randomBytes(6).toString('hex')}`);
        log.info(`Using Chrome user data dir: ${userDataDir}`);

        let browserContext;
        try {
            browserContext = await chromium.launchPersistentContext(userDataDir, {
                channel: 'chrome',   // Use real installed Chrome binary
                headless: false,     // Required for high-security bypass (Cloudflare)
                noViewport: true,    // Avoids viewport-based fingerprinting
                proxy: browserProxyUrl ? { server: browserProxyUrl } : undefined,
            });
        } catch (launchErr) {
            log.error(`Failed to launch Chrome browser: ${launchErr.message}`);
            throw launchErr;
        }

        const page = await browserContext.newPage();

        try {
            // Block heavy resources for performance
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                const reqUrl = route.request().url();
                if (
                    ['image', 'font', 'media'].includes(type) ||
                    reqUrl.includes('google-analytics') ||
                    reqUrl.includes('googletagmanager') ||
                    reqUrl.includes('doubleclick') ||
                    reqUrl.includes('cdn.pixabay.com') ||
                    reqUrl.includes('snowplow')
                ) {
                    return route.abort();
                }
                return route.continue();
            });

            let currentPageNo = 1;
            let totalPages = 1;

            while (saved < RESULTS_WANTED && currentPageNo <= MAX_PAGES && currentPageNo <= totalPages) {
                const pageUrl = currentPageNo === 1
                    ? startSearchUrl
                    : buildNextPageUrl(startSearchUrl, currentPageNo);

                log.info(`Fetching page ${currentPageNo}: ${pageUrl}`);

                // Navigate to the search page
                await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await page.waitForTimeout(2000 + Math.floor(Math.random() * 1500));

                // Human-like interaction
                await page.mouse.move(100 + Math.floor(Math.random() * 200), 200 + Math.floor(Math.random() * 200), { steps: 15 });
                await page.mouse.wheel(0, 250 + Math.floor(Math.random() * 150));
                await page.waitForTimeout(800);

                // Step 1: Try to get bootstrap data from window.__BOOTSTRAP__ (fastest path)
                let bootstrapData = null;
                try {
                    bootstrapData = await page.evaluate(() => window.__BOOTSTRAP__ || null);
                    if (bootstrapData?.page?.results) {
                        log.info(`Got bootstrap data from window.__BOOTSTRAP__ directly`);
                    } else {
                        bootstrapData = null;
                    }
                } catch { /* ignore */ }

                // Step 2: Extract bootstrap URL and navigate to it (most reliable path)
                if (!bootstrapData) {
                    const bootstrapUrl = await getBootstrapUrlFromPage(page);

                    if (bootstrapUrl) {
                        // Navigate page directly to the bootstrap JSON — preserves all session cookies
                        bootstrapData = await fetchBootstrapByNavigation(page, bootstrapUrl, pageUrl);

                        // If navigation worked, go back to search page for next iteration
                        // (we don't actually need to — we'll navigate to next page URL directly)
                    } else {
                        log.warning(`Page ${currentPageNo}: Could not find __BOOTSTRAP_URL__. Skipping.`);
                    }
                }

                if (!bootstrapData || !bootstrapData.page || !bootstrapData.page.results) {
                    log.warning(`Page ${currentPageNo}: No bootstrap data available. Stopping.`);
                    break;
                }

                const results = bootstrapData.page.results;
                totalPages = bootstrapData.page.pages || totalPages;
                const totalResults = bootstrapData.page.total || 0;

                log.info(`Page ${currentPageNo}/${totalPages} — ${results.length} images on this page (${totalResults} total available)`);

                if (results.length === 0) {
                    log.info('No results on this page. Stopping.');
                    break;
                }

                // Extract and save image data up to the remaining limit
                const remaining = RESULTS_WANTED - saved;
                const toProcess = results.slice(0, remaining);

                const items = [];
                for (const result of toProcess) {
                    const item = extractImageData(result);
                    if (Object.keys(item).length > 0) {
                        items.push(item);
                    }
                }

                if (items.length > 0) {
                    await Dataset.pushData(items);
                    saved += items.length;
                    log.info(`Saved ${items.length} images (total: ${saved}/${RESULTS_WANTED})`);
                }

                if (saved >= RESULTS_WANTED) {
                    log.info(`Reached results limit (${RESULTS_WANTED}). Done.`);
                    break;
                }

                if (currentPageNo >= MAX_PAGES) {
                    log.info(`Reached max pages limit (${MAX_PAGES}). Done.`);
                    break;
                }

                if (currentPageNo >= totalPages) {
                    log.info(`Reached last page (${totalPages}). Done.`);
                    break;
                }

                currentPageNo++;

                // Small human-like delay between pages
                await page.waitForTimeout(1500 + Math.floor(Math.random() * 1000));
            }
        } finally {
            await page.close();
            await browserContext.close();
        }

        log.info(`Finished! Saved ${saved} images total.`);
    } finally {
        await Actor.exit();
    }
}

main().catch(err => { log.error(err); process.exit(1); });
