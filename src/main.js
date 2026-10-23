import { Actor, Dataset, log } from 'apify';
import { Impit } from 'impit';

import {
    buildPageUrl,
    buildSearchUrl,
    detectChallenge,
    extractBootstrapPath,
    getDedupKey,
    mapResult,
    normalizeSearchUrl,
    normalizeText,
    parseJsonLdImages,
    parseSearchPayload,
    readPositiveInt,
    selectImageResults,
} from './pixabay.js';

// Read API_Discovery.md before changing the request flow or profile order.
const DEFAULT_KEYWORD = 'nature';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS_PER_PAGE = 10;
const MAX_RETRIES_PER_REQUEST = 2;
const PAGE_FAILURE_LIMIT = 3;

const PROFILES = [
    'chrome151',
    'chrome142',
    'chrome136',
    'chrome124',
    'chrome',
    'firefox',
    'firefox144',
    'firefox135',
    'ios18',
    'okhttp5',
];

const STRATEGIES = ['json', 'html'];
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function shortError(error) {
    const message = error?.message ? String(error.message) : String(error);
    const firstLine = message.split('\n').find((line) => line.trim()) || 'Unknown error';
    const compact = firstLine
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.;]+$/, '');
    return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function backoffDelay(attempt) {
    const base = Math.min(8000, 600 * 2 ** attempt);
    return base + Math.floor(Math.random() * 300);
}

function parseRetryAfter(value) {
    if (!value) return 0;

    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10000);

    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return Math.min(Math.max(timestamp - Date.now(), 0), 10000);

    return 0;
}

function jsonHeaders(referer) {
    return {
        Accept: 'application/json',
        'x-fetch-bootstrap': '1',
        'x-bootstrap-cache-miss': '1',
        Referer: referer,
        Cookie: 'g_rated=1',
    };
}

function htmlHeaders(referer) {
    return {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        Referer: referer,
        Cookie: 'g_rated=1',
    };
}

async function readJsonResponse(response) {
    const text = await response.text();
    const challenge = detectChallenge(response.status, text);
    if (challenge) throw new Error(challenge);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('json')) {
        throw new Error(`Expected JSON but received ${contentType || 'an unknown content type'}`);
    }

    try {
        return JSON.parse(text);
    } catch {
        throw new Error('Pixabay returned malformed JSON.');
    }
}

async function readHtmlResponse(response) {
    const text = await response.text();
    const challenge = detectChallenge(response.status, text);
    if (challenge) throw new Error(challenge);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!text.includes('<html')) throw new Error('Pixabay did not return an HTML page.');
    return text;
}

class PixabayEngine {
    constructor(proxyConfiguration) {
        this.proxyConfiguration = proxyConfiguration;
        this.clients = new Map();
        this.activeProfile = 0;
        this.activeStrategy = 0;
        this.switches = 0;
    }

    async getClient(profile) {
        const existing = this.clients.get(profile);
        if (existing) return existing;

        const proxyUrl = this.proxyConfiguration ? await this.proxyConfiguration.newUrl() : undefined;
        const client = new Impit({
            browser: profile,
            timeout: REQUEST_TIMEOUT_MS,
            ...(proxyUrl ? { proxyUrl } : {}),
        });

        this.clients.set(profile, client);
        return client;
    }

    async request(url, headers, profile) {
        const client = await this.getClient(profile);
        let lastError;

        for (let attempt = 0; attempt <= MAX_RETRIES_PER_REQUEST; attempt += 1) {
            try {
                const response = await client.fetch(url, { headers, redirect: 'follow' });

                if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES_PER_REQUEST) {
                    const wait = parseRetryAfter(response.headers.get('retry-after')) || backoffDelay(attempt);
                    log.warning(`Pixabay returned HTTP ${response.status}. Retrying in ${Math.round(wait / 1000)}s.`);
                    await sleep(wait);
                    continue;
                }

                return response;
            } catch (error) {
                lastError = error;
                if (attempt < MAX_RETRIES_PER_REQUEST) {
                    const wait = backoffDelay(attempt);
                    log.warning(
                        `Pixabay request failed: ${shortError(error)}. Retrying in ${Math.round(wait / 1000)}s.`,
                    );
                    await sleep(wait);
                }
            }
        }

        throw lastError || new Error('Pixabay request failed without a response.');
    }

    async fetchJson(profile, pageUrl, baseUrl) {
        const response = await this.request(pageUrl, jsonHeaders(baseUrl), profile);
        const json = await readJsonResponse(response);
        const payload = parseSearchPayload(json);

        if (!payload) throw new Error('JSON response did not contain page results.');

        if (payload.total === 0 && payload.results.length === 0) {
            return { results: [], total: 0, pages: 0, validEmpty: true, profile, strategy: 'json' };
        }

        const results = selectImageResults(payload.results);
        if (!results.length) {
            throw new Error(
                `JSON response contained ${payload.results.length} records but none were usable image records.`,
            );
        }

        return {
            results,
            total: payload.total,
            pages: payload.pages,
            validEmpty: false,
            profile,
            strategy: 'json',
        };
    }

    async fetchHtml(profile, pageUrl, baseUrl) {
        const response = await this.request(pageUrl, htmlHeaders(baseUrl), profile);
        const html = await readHtmlResponse(response);
        const bootstrapPath = extractBootstrapPath(html);

        if (bootstrapPath) {
            try {
                const bootstrapUrl = new URL(bootstrapPath, baseUrl).href;
                const bootstrapResponse = await this.request(bootstrapUrl, jsonHeaders(pageUrl), profile);
                const json = await readJsonResponse(bootstrapResponse);
                const payload = parseSearchPayload(json);

                if (payload && payload.total === 0 && payload.results.length === 0) {
                    return { results: [], total: 0, pages: 0, validEmpty: true, profile, strategy: 'bootstrap' };
                }

                if (payload) {
                    const results = selectImageResults(payload.results);
                    if (results.length) {
                        return {
                            results,
                            total: payload.total,
                            pages: payload.pages,
                            validEmpty: false,
                            profile,
                            strategy: 'bootstrap',
                        };
                    }
                }

                log.warning('Bootstrap data was empty or malformed. Trying embedded page data.');
            } catch (error) {
                log.warning(`Bootstrap request failed: ${shortError(error)}. Trying embedded page data.`);
            }
        }

        const jsonLdResults = parseJsonLdImages(html, pageUrl);
        if (jsonLdResults.length) {
            return {
                results: jsonLdResults,
                total: jsonLdResults.length,
                pages: 0,
                validEmpty: false,
                profile,
                strategy: 'jsonld',
            };
        }

        throw new Error('HTML page did not contain bootstrap or JSON-LD image data.');
    }

    async attempt(profileIndex, strategyIndex, pageNumber, baseUrl) {
        const profile = PROFILES[profileIndex];
        const strategy = STRATEGIES[strategyIndex];
        const pageUrl = buildPageUrl(baseUrl, pageNumber);

        if (strategy === 'json') return this.fetchJson(profile, pageUrl, baseUrl);
        return this.fetchHtml(profile, pageUrl, baseUrl);
    }

    async fetchPage(pageNumber, baseUrl) {
        const failures = [];
        const attempts = Math.min(MAX_ATTEMPTS_PER_PAGE, PROFILES.length * STRATEGIES.length);

        for (let offset = 0; offset < attempts; offset += 1) {
            const profileIndex = (this.activeProfile + Math.floor(offset / STRATEGIES.length)) % PROFILES.length;
            const strategyIndex = (this.activeStrategy + (offset % STRATEGIES.length)) % STRATEGIES.length;
            const profile = PROFILES[profileIndex];
            const strategy = STRATEGIES[strategyIndex];

            try {
                const result = await this.attempt(profileIndex, strategyIndex, pageNumber, baseUrl);

                if (profileIndex !== this.activeProfile || strategyIndex !== this.activeStrategy) {
                    this.switches += 1;
                    log.info(`Request path recovered with profile=${profile} and strategy=${result.strategy}.`);
                }
                this.activeProfile = profileIndex;
                this.activeStrategy = strategyIndex;
                return result;
            } catch (error) {
                failures.push(`${profile}/${strategy}: ${shortError(error)}`);
                log.warning(
                    `Page ${pageNumber} attempt ${offset + 1} failed (${profile}/${strategy}): ${shortError(error)}`,
                );
            }
        }

        const recent = failures.slice(-3).join(' | ');
        throw new Error(`Could not load page ${pageNumber} after ${failures.length} attempts. Last errors: ${recent}`);
    }
}

async function createProxyConfiguration(proxyInput) {
    if (!proxyInput || typeof proxyInput !== 'object') return undefined;

    const customUrls = Array.isArray(proxyInput.proxyUrls) ? proxyInput.proxyUrls.filter(Boolean) : [];
    const wantsApifyProxy = Boolean(proxyInput.useApifyProxy);

    if (customUrls.length) return Actor.createProxyConfiguration(proxyInput);
    if (wantsApifyProxy && Actor.isAtHome()) return Actor.createProxyConfiguration(proxyInput);
    if (wantsApifyProxy) log.info('Apify Proxy requires a cloud run. Continuing without a proxy.');

    return undefined;
}

function resolveBaseUrl(input) {
    const suppliedUrl = normalizeText(input.startUrl) || normalizeText(input.url);
    if (suppliedUrl) {
        const normalized = normalizeSearchUrl(suppliedUrl);
        if (normalized) return normalized;
        log.warning('The supplied URL is not a Pixabay image search URL. Falling back to a keyword search.');
    }

    const keyword = normalizeText(input.keyword) || DEFAULT_KEYWORD;
    const location = normalizeText(input.location);
    return buildSearchUrl(keyword, location);
}

function resolveStopReason({ saved, resultsWanted, validEmpty, emptyPages, pageNumber, maxPages, totalPages }) {
    if (saved >= resultsWanted) return 'target_reached';
    if (validEmpty) return 'no_matches';
    if (emptyPages >= PAGE_FAILURE_LIMIT) return 'no_new_results';
    if (pageNumber > maxPages) return 'page_limit';
    if (pageNumber > totalPages) return 'last_page';
    return 'partial';
}

async function run() {
    const input = (await Actor.getInput()) || {};
    const resultsWanted = readPositiveInt(input.results_wanted, 20);
    const maxPages = readPositiveInt(input.max_pages, 10);
    const baseUrl = resolveBaseUrl(input);

    log.info(`Pixabay image scraper starting | source=${baseUrl} | target=${resultsWanted} | max_pages=${maxPages}`);

    const proxyConfiguration = await createProxyConfiguration(input.proxyConfiguration);
    if (proxyConfiguration) log.info('Proxy configuration enabled.');

    const engine = new PixabayEngine(proxyConfiguration);
    const seen = new Set();

    let saved = 0;
    let pageNumber = 1;
    let totalPages = maxPages;
    let pagesProcessed = 0;
    let emptyPages = 0;
    let validEmpty = false;

    while (
        saved < resultsWanted &&
        pageNumber <= maxPages &&
        pageNumber <= totalPages &&
        emptyPages < PAGE_FAILURE_LIMIT
    ) {
        let page;
        try {
            page = await engine.fetchPage(pageNumber, baseUrl);
        } catch (error) {
            if (saved === 0) throw error;
            log.warning(`Stopping after page ${pageNumber} failed: ${shortError(error)}`);
            pagesProcessed += 1;
            break;
        }

        pagesProcessed += 1;

        if (page.validEmpty) {
            validEmpty = true;
            break;
        }

        if (page.pages > 0) totalPages = Math.min(maxPages, page.pages);

        const batch = [];
        for (const result of page.results) {
            if (saved + batch.length >= resultsWanted) break;

            const item = mapResult(result);
            if (!item) continue;

            const key = getDedupKey(item);
            if (!key || seen.has(key)) continue;
            if (!item.pageUrl || (!item.imageUrl_large && !item.imageUrl_small)) continue;

            seen.add(key);
            batch.push(item);
        }

        if (batch.length) {
            await Dataset.pushData(batch);
            saved += batch.length;
            emptyPages = 0;
            log.info(
                `Saved ${batch.length} images | total=${saved}/${resultsWanted} | page=${pageNumber} | path=${page.profile}/${page.strategy}`,
            );
        } else {
            emptyPages += 1;
            log.warning(`Page ${pageNumber} produced no new images | path=${page.profile}/${page.strategy}`);
        }

        pageNumber += 1;
    }

    const stopReason = resolveStopReason({
        saved,
        resultsWanted,
        validEmpty,
        emptyPages,
        pageNumber,
        maxPages,
        totalPages,
    });

    if (saved === 0 && !validEmpty) {
        throw new Error(
            'No usable images were collected. Pixabay may have changed its response format or blocked the request.',
        );
    }

    log.info(
        `Finished | saved=${saved} | pages=${pagesProcessed} | request_path_switches=${engine.switches} | stop=${stopReason}`,
    );
}

await Actor.init();

try {
    await run();
    await Actor.exit();
} catch (error) {
    log.error(`Pixabay scraper failed: ${shortError(error)}`);
    await Actor.exit({ exitCode: 1 });
}
