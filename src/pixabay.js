const PIXABAY_ORIGIN = 'https://pixabay.com';
const IMAGE_MEDIA_TYPES = new Set(['photo', 'illustration', 'vector', 'gif']);

const SKIPPED_FIELDS = new Set([
    'sources_downloadUrl',
    'sources_1x',
    'sources_2x',
    'user_profileUrl',
    'user_username',
    'user_donation_paypal',
    'user_donation_method',
    'tagList',
    'tagLinks',
    'attributionHtml',
    'likeHref',
    'commentHref',
    'contentIdCertificateUrl',
    'canvaBackgroundRemoverUrl',
    'canvaInpaintingEditorUrl',
    'canvaCropImageUrl',
    'canvaAdjustColoursUrl',
    'canvaCreateSocialPostUrl',
]);

export function normalizeText(value) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}

export function readPositiveInt(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.floor(parsed);
}

export function absoluteUrl(value, base = PIXABAY_ORIGIN) {
    const text = normalizeText(value);
    if (!text) return undefined;

    try {
        return new URL(text, base).href;
    } catch {
        return undefined;
    }
}

function buildSearchSlug(keyword, location) {
    return [keyword, location]
        .map((value) => normalizeText(value))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, '-');
}

export function buildSearchUrl(keyword, location) {
    const slug = buildSearchSlug(keyword, location);
    if (!slug) return `${PIXABAY_ORIGIN}/images/search/`;
    return `${PIXABAY_ORIGIN}/images/search/${encodeURIComponent(slug)}/`;
}

export function normalizeSearchUrl(rawUrl) {
    const text = normalizeText(rawUrl);
    if (!text) return undefined;

    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;

    let parsed;
    try {
        parsed = new URL(withScheme);
    } catch {
        return undefined;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'pixabay.com' && !hostname.endsWith('.pixabay.com')) return undefined;
    if (!parsed.pathname.toLowerCase().includes('/images/search')) return undefined;

    if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
    parsed.searchParams.delete('pagi');
    parsed.hash = '';
    return parsed.href;
}

export function buildPageUrl(baseUrl, pageNumber) {
    const parsed = new URL(baseUrl);
    if (pageNumber > 1) parsed.searchParams.set('pagi', String(pageNumber));
    else parsed.searchParams.delete('pagi');
    return parsed.href;
}

export function extractBootstrapPath(html) {
    if (typeof html !== 'string') return undefined;
    const match = html.match(/window\.__BOOTSTRAP_URL__\s*=\s*['"]([^'"]+)['"]/);
    return match ? match[1] : undefined;
}

function parseJsonLdScripts(html) {
    const entries = [];
    const pattern = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;

    for (const match of html.matchAll(pattern)) {
        try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed)) entries.push(...parsed);
            else entries.push(parsed);
        } catch {
            continue;
        }
    }

    return entries;
}

function inferMediaType(url) {
    if (typeof url !== 'string') return 'photo';
    if (url.includes('/illustration/')) return 'illustration';
    if (url.includes('/vector/')) return 'vector';
    if (url.includes('/gif/')) return 'gif';
    return 'photo';
}

function extractIdFromUrl(value) {
    if (typeof value !== 'string') return undefined;
    const pathMatch = value.match(/-(\d+)(?:[/?]|$)/);
    if (pathMatch) return Number(pathMatch[1]);

    const fileMatch = value.match(/_(\d+)_\d+\.(?:jpg|jpeg|png|webp|gif)/i);
    if (fileMatch) return Number(fileMatch[1]);

    return undefined;
}

export function parseJsonLdImages(html, pageUrl = PIXABAY_ORIGIN) {
    if (typeof html !== 'string') return [];

    const items = [];
    const seen = new Set();

    for (const entry of parseJsonLdScripts(html)) {
        if (!entry || typeof entry !== 'object') continue;

        const type = entry['@type'];
        const isImage = Array.isArray(type) ? type.includes('ImageObject') : type === 'ImageObject';
        if (!isImage) continue;

        const contentUrl = absoluteUrl(entry.contentUrl, pageUrl);
        const thumbnailUrl = absoluteUrl(entry.thumbnailUrl, pageUrl);
        if (!contentUrl && !thumbnailUrl) continue;

        const pageLink = absoluteUrl(entry.acquireLicensePage, pageUrl);
        const id = extractIdFromUrl(pageLink) ?? extractIdFromUrl(contentUrl);
        if (!id || seen.has(id)) continue;

        seen.add(id);
        items.push({
            id,
            mediaType: inferMediaType(contentUrl || thumbnailUrl),
            sources: {
                '1x': thumbnailUrl || contentUrl,
                '2x': contentUrl || thumbnailUrl,
            },
            href: pageLink ? new URL(pageLink).pathname : undefined,
            name: normalizeText(entry.name),
            title: normalizeText(entry.name),
        });
    }

    return items;
}

function normalizeTags(tagList) {
    if (!Array.isArray(tagList)) return [];

    const tags = [];
    for (const entry of tagList) {
        const value = Array.isArray(entry) ? entry[0] : entry;
        const tag = normalizeText(value);
        if (tag) tags.push(tag);
    }
    return tags;
}

function sanitizeValue(value) {
    if (value === null || value === undefined) return undefined;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || undefined;
    }

    if (Array.isArray(value)) {
        const cleaned = value.map((entry) => sanitizeValue(entry)).filter((entry) => entry !== undefined);
        return cleaned.length ? cleaned : undefined;
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
            const isPrimitiveList = cleaned.every((entry) => typeof entry !== 'object' || entry === null);
            if (isPrimitiveList) {
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

export function mapResult(result) {
    if (!result || typeof result !== 'object') return undefined;

    const tags = normalizeTags(result.tagList);
    const flattened = flattenRecord({
        ...result,
        pageUrl: absoluteUrl(result.href),
        downloadUrl: absoluteUrl(result.sources?.downloadUrl),
        profileUrl: absoluteUrl(result.user?.profileUrl),
        imageUrl_small: absoluteUrl(result.sources?.['1x']),
        imageUrl_large: absoluteUrl(result.sources?.['2x']),
        tags: tags.join(', '),
        username: normalizeText(result.user?.username),
    });

    const item = {};
    for (const [key, value] of Object.entries(flattened)) {
        if (SKIPPED_FIELDS.has(key)) continue;
        if (key.startsWith('tagList_') || key.startsWith('user_socialLinks') || key.startsWith('user_donations')) {
            continue;
        }
        item[key] = value;
    }

    return item;
}

export function getDedupKey(item) {
    if (!item) return '';
    return String(item.id || item.pageUrl || item.imageUrl_large || item.imageUrl_small || '');
}

export function isImageResult(result) {
    if (!result || typeof result !== 'object') return false;

    const mediaType = normalizeText(result.mediaType)?.toLowerCase();
    if (!mediaType || !IMAGE_MEDIA_TYPES.has(mediaType)) return false;
    if (!result.id && !result.href) return false;

    const sources = result.sources || {};
    return Boolean(sources['1x'] || sources['2x'] || sources.downloadUrl);
}

export function selectImageResults(results) {
    if (!Array.isArray(results)) return [];

    const seen = new Set();
    const selected = [];

    for (const result of results) {
        if (!isImageResult(result)) continue;

        const key = String(result.id || result.href);
        if (!key || seen.has(key)) continue;

        seen.add(key);
        selected.push(result);
    }

    return selected;
}

function toNonNegativeInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

function looksLikeImageRecords(value) {
    if (!Array.isArray(value) || value.length === 0) return false;

    return value.slice(0, 3).some((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        return Boolean((entry.id || entry.href) && (entry.sources || entry.mediaType));
    });
}

function findResultsArray(json) {
    const directCandidates = [
        json.page?.results,
        json.page?.items,
        json.page?.hits,
        json.results,
        json.items,
        json.hits,
        json.records,
        json.data?.results,
        json.data?.items,
    ];

    for (const candidate of directCandidates) {
        if (looksLikeImageRecords(candidate)) return candidate;
    }

    const queue = [json];
    let visited = 0;

    while (queue.length && visited < 50) {
        const current = queue.shift();
        visited += 1;

        if (looksLikeImageRecords(current)) return current;
        if (!current || typeof current !== 'object') continue;

        for (const value of Object.values(current)) {
            if (value && typeof value === 'object') queue.push(value);
        }
    }

    return undefined;
}

export function parseSearchPayload(json) {
    if (!json || typeof json !== 'object') return undefined;

    const { page } = json;
    if (page && typeof page === 'object') {
        return {
            results: Array.isArray(page.results) ? page.results : [],
            total: toNonNegativeInt(page.total),
            pages: toNonNegativeInt(page.pages),
            perPage: toNonNegativeInt(page.perPage),
        };
    }

    const results = findResultsArray(json);
    if (results) {
        return {
            results,
            total: results.length,
            pages: 1,
            perPage: results.length,
        };
    }

    return undefined;
}

export function detectChallenge(status, body) {
    if (status === 401 || status === 403 || status === 429) return `HTTP ${status}`;
    if (typeof body !== 'string') return undefined;

    const head = body.slice(0, 5000);
    if (
        /just a moment|cf-challenge|attention required|access denied|pardon our interruption|verify you are human|dangerous site/i.test(
            head,
        )
    ) {
        return 'challenge page';
    }

    return undefined;
}
