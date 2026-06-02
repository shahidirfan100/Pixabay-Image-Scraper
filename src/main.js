import { Actor, Dataset, log } from 'apify';
import { randomBytes } from 'crypto';
import os from 'os';
import { chromium } from 'patchright';
import path from 'path';

await Actor.init();

function buildSearchSlug(keyword = '', location = '') {
    return [keyword, location]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, '-');
}

function buildSearchUrl(keyword, location) {
    const base = 'https://pixabay.com/images/search/';
    const slug = buildSearchSlug(keyword, location);
    return slug ? `${base}${encodeURIComponent(slug)}/` : base;
}

function normalizeUrl(url, keyword, location) {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes('pixabay.com')) return buildSearchUrl(keyword, location);
        if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
        parsed.searchParams.delete('pagi');
        return parsed.href;
    } catch {
        return buildSearchUrl(keyword, location);
    }
}

function buildPageUrl(baseUrl, pageNumber) {
    if (pageNumber === 1) return baseUrl;

    const parsed = new URL(baseUrl);
    parsed.searchParams.set('pagi', String(pageNumber));
    return parsed.href;
}

function sanitizeValue(value) {
    if (value == null) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }
    if (Array.isArray(value)) {
        const cleaned = value.map((entry) => sanitizeValue(entry)).filter((entry) => entry !== undefined);
        if (!cleaned.length) return undefined;
        return cleaned;
    }
    if (typeof value === 'object') return value;
    return value;
}

function flattenRecord(value, prefix = '') {
    const output = {};

    const appendValue = (currentValue, currentPrefix) => {
        const cleaned = sanitizeValue(currentValue);
        if (cleaned === undefined) return;

        if (Array.isArray(cleaned)) {
            if (cleaned.every((entry) => typeof entry !== 'object' || entry === null)) {
                output[currentPrefix] = cleaned.join(', ');
                return;
            }

            cleaned.forEach((entry, index) => {
                if (typeof entry === 'object' && entry !== null) {
                    appendValue(entry, `${currentPrefix}_${index}`);
                } else if (entry !== undefined) {
                    output[`${currentPrefix}_${index}`] = entry;
                }
            });
            return;
        }

        if (typeof cleaned === 'object') {
            for (const [key, nestedValue] of Object.entries(cleaned)) {
                const nestedPrefix = currentPrefix ? `${currentPrefix}_${key}` : key;
                appendValue(nestedValue, nestedPrefix);
            }
            return;
        }

        output[currentPrefix] = cleaned;
    };

    appendValue(value, prefix);
    return output;
}

function mapResult(result) {
    const item = {};
    const fullPageUrl = result.href ? `https://pixabay.com${result.href}` : undefined;
    const fullDownloadUrl = result.sources?.downloadUrl
        ? `https://pixabay.com${result.sources.downloadUrl}`
        : undefined;
    const fullProfileUrl = result.user?.profileUrl
        ? `https://pixabay.com${result.user.profileUrl}`
        : undefined;
    const tags = Array.isArray(result.tagList)
        ? result.tagList
            .map((entry) => (Array.isArray(entry) ? entry[0] : entry))
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
        : [];

    const flattened = flattenRecord({
        ...result,
        pageUrl: fullPageUrl,
        downloadUrl: fullDownloadUrl,
        profileUrl: fullProfileUrl,
        imageUrl_small: result.sources?.['1x'],
        imageUrl_large: result.sources?.['2x'],
        tags,
        username: result.user?.username,
    });

    for (const [key, value] of Object.entries(flattened)) {
        if (
            [
                'sources_downloadUrl',
                'sources_1x',
                'sources_2x',
                'user_profileUrl',
                'user_username',
                'tagList',
                'tagLinks',
                'attributionHtml',
            ].includes(key)
            || key.startsWith('tagList_')
        ) {
            continue;
        }

        item[key] = value;
    }

    return item;
}

function getDedupKey(item) {
    return String(item.id || item.pageUrl || item.imageUrl_large || item.imageUrl_small || '');
}

async function safeGoto(page, targetUrl, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
            });
        } catch (error) {
            log.warning(`Navigation attempt ${attempt}/${retries} failed for ${targetUrl}: ${error.message}`);
            if (attempt < retries) {
                await page.waitForTimeout(2000 * attempt);
            }
        }
    }

    return null;
}

async function waitForCloudflare(page, timeoutMs = 15000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const title = await page.title().catch(() => '');
        const html = await page.content().catch(() => '');

        if (!title.includes('Just a moment') && !html.includes('cf-challenge') && !html.includes('cloudflare')) {
            return true;
        }

        log.info('Cloudflare challenge detected. Waiting 2s for resolution...');
        await page.waitForTimeout(2000);
    }

    return false;
}

async function fetchSearchPayload(page, targetUrl) {
    return page.evaluate(async (url) => {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'x-fetch-bootstrap': '1',
                    'x-bootstrap-cache-miss': '1',
                    'cache-control': 'max-age=0',
                },
                cache: 'no-store',
                credentials: 'same-origin',
            });

            const text = await response.text();
            let json = null;
            try {
                json = JSON.parse(text);
            } catch {
                json = null;
            }

            return {
                ok: response.ok,
                status: response.status,
                contentType: response.headers.get('content-type'),
                json,
                bodyPreview: text.slice(0, 500),
            };
        } catch (error) {
            return {
                ok: false,
                status: 0,
                contentType: null,
                json: null,
                bodyPreview: String(error),
            };
        }
    }, targetUrl);
}

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            keyword = '',
            location = '',
            url = '',
            startUrl = '',
            results_wanted: resultsWantedRaw = 20,
            max_pages: maxPagesRaw = 999,
            proxyConfiguration,
        } = input;

        const resultsWanted = Number.isFinite(+resultsWantedRaw)
            ? Math.max(1, +resultsWantedRaw)
            : Number.MAX_SAFE_INTEGER;
        const maxPages = Number.isFinite(+maxPagesRaw) ? Math.max(1, +maxPagesRaw) : 999;

        const isApifyCloud = Actor.isAtHome();
        const shouldUseApifyProxy = Boolean(proxyConfiguration?.useApifyProxy);
        const hasCustomProxyUrls = Array.isArray(proxyConfiguration?.proxyUrls) && proxyConfiguration.proxyUrls.length > 0;

        let proxyConf;
        if (proxyConfiguration && (hasCustomProxyUrls || (shouldUseApifyProxy && isApifyCloud))) {
            proxyConf = await Actor.createProxyConfiguration({ ...proxyConfiguration });
        } else if (shouldUseApifyProxy && !isApifyCloud) {
            log.info('Local run detected: running without proxy.');
        }

        const browserProxyUrl = proxyConf ? await proxyConf.newUrl() : undefined;
        let initialUrl = buildSearchUrl(keyword, location);
        if (url) initialUrl = normalizeUrl(url, keyword, location);
        if (startUrl) initialUrl = normalizeUrl(startUrl, keyword, location);

        log.info(`Starting Pixabay image scraper: ${initialUrl}`);
        log.info(`Target: ${resultsWanted} images, max ${maxPages} pages`);

        const userDataDir = path.join(os.tmpdir(), `pixabay-${randomBytes(6).toString('hex')}`);
        const chromePath = process.env.APIFY_CHROME_EXECUTABLE_PATH || process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH;
        const launchCandidates = [
            ...(chromePath ? [{ executablePath: chromePath, label: `Chrome at ${chromePath}` }] : []),
            { channel: 'chrome', label: 'Chrome (channel lookup)' },
            { label: 'bundled Chromium' },
        ];

        let browserContext;
        for (const { executablePath, channel, label } of launchCandidates) {
            try {
                browserContext = await chromium.launchPersistentContext(userDataDir, {
                    ...(executablePath ? { executablePath } : {}),
                    ...(channel ? { channel } : {}),
                    headless: false,
                    noViewport: true,
                    proxy: browserProxyUrl ? { server: browserProxyUrl } : undefined,
                });
                log.info(`Browser launched: ${label}`);
                break;
            } catch (error) {
                log.warning(`Could not launch ${label}: ${error.message}`);
            }
        }

        if (!browserContext) {
            throw new Error('All browser launch attempts failed.');
        }

        const page = await browserContext.newPage();

        try {
            await page.route('**/*', (route) => {
                const resourceType = route.request().resourceType();
                const requestUrl = route.request().url();

                if (
                    ['image', 'font', 'media'].includes(resourceType)
                    || requestUrl.includes('google-analytics')
                    || requestUrl.includes('googletagmanager')
                    || requestUrl.includes('doubleclick')
                    || requestUrl.includes('snowplow')
                ) {
                    return route.abort();
                }

                return route.continue();
            });

            const seen = new Set();
            let saved = 0;
            let pageNumber = 1;
            let totalPages = maxPages;
            let consecutiveFailures = 0;

            while (
                saved < resultsWanted
                && pageNumber <= maxPages
                && pageNumber <= totalPages
                && consecutiveFailures < 3
            ) {
                const pageUrl = buildPageUrl(initialUrl, pageNumber);
                log.info(`Loading page ${pageNumber}: ${pageUrl}`);

                const response = await safeGoto(page, pageUrl);
                if (!response) {
                    consecutiveFailures++;
                    pageNumber++;
                    continue;
                }

                await waitForCloudflare(page);
                await page.waitForTimeout(1200 + Math.floor(Math.random() * 800));

                const payload = await fetchSearchPayload(page, pageUrl);
                const results = payload.json?.page?.results || [];
                totalPages = payload.json?.page?.pages || totalPages;
                const totalResults = payload.json?.page?.total || 0;

                if (!results.length) {
                    consecutiveFailures++;
                    log.warning(
                        `No structured results found on page ${pageNumber}. Status: ${payload.status}. Type: ${payload.contentType || 'n/a'}. Body preview: ${payload.bodyPreview}`,
                    );
                    pageNumber++;
                    continue;
                }

                log.info(
                    `Structured payload ready: page ${pageNumber}/${totalPages}, ${results.length} records, ${totalResults} total available.`,
                );

                const batch = [];
                for (const result of results) {
                    if (saved + batch.length >= resultsWanted) break;

                    const item = mapResult(result);
                    const dedupKey = getDedupKey(item);
                    if (!dedupKey || seen.has(dedupKey)) continue;
                    if (!item.pageUrl || (!item.imageUrl_large && !item.imageUrl_small)) continue;

                    seen.add(dedupKey);
                    batch.push(item);
                }

                if (batch.length) {
                    await Dataset.pushData(batch);
                    saved += batch.length;
                    log.info(`Saved ${batch.length} unique items (total: ${saved}/${resultsWanted})`);
                } else {
                    log.warning(`Page ${pageNumber} produced only duplicates or incomplete records.`);
                }

                consecutiveFailures = 0;
                pageNumber++;
                await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));
            }

            if (consecutiveFailures >= 3) {
                log.warning('Stopped after 3 consecutive pages without usable structured data.');
            }

            log.info(`Finished! Saved ${saved} unique images total.`);
        } finally {
            await page.close().catch(() => {});
            await browserContext.close().catch(() => {});
        }
    } finally {
        await Actor.exit();
    }
}

main().catch((error) => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
