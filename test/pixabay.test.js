import { describe, expect, it } from 'vitest';

import {
    buildPageUrl,
    buildSearchUrl,
    detectChallenge,
    extractBootstrapPath,
    mapResult,
    normalizeSearchUrl,
    parseJsonLdImages,
    parseSearchPayload,
    readPositiveInt,
    selectImageResults,
} from '../src/pixabay.js';

describe('search URLs', () => {
    it('builds a keyword search URL', () => {
        expect(buildSearchUrl('nature')).toBe('https://pixabay.com/images/search/nature/');
    });

    it('combines keyword and location into the search phrase', () => {
        expect(buildSearchUrl('cherry blossom', 'Tokyo')).toBe(
            'https://pixabay.com/images/search/cherry-blossom-Tokyo/',
        );
    });

    it('keeps filter parameters and removes pagination from a supplied URL', () => {
        expect(
            normalizeSearchUrl('https://pixabay.com/images/search/nature/?pagi=3&order=latest&orientation=horizontal'),
        ).toBe('https://pixabay.com/images/search/nature/?order=latest&orientation=horizontal');
    });

    it('accepts a URL without a scheme', () => {
        expect(normalizeSearchUrl('pixabay.com/images/search/nature')).toBe(
            'https://pixabay.com/images/search/nature/',
        );
    });

    it('rejects non-Pixabay and non-search URLs', () => {
        expect(normalizeSearchUrl('https://example.com/images/search/nature/')).toBeUndefined();
        expect(normalizeSearchUrl('https://pixabay.com/photos/nature-123/')).toBeUndefined();
    });

    it('only adds the pagination parameter after the first page', () => {
        const base = 'https://pixabay.com/images/search/nature/?order=latest';
        expect(buildPageUrl(base, 1)).toBe(base);
        expect(buildPageUrl(base, 3)).toBe(`${base}&pagi=3`);
    });
});

describe('input normalization', () => {
    it('keeps positive integer limits', () => {
        expect(readPositiveInt('25', 20)).toBe(25);
    });

    it('falls back for empty, zero, negative, and invalid limits', () => {
        expect(readPositiveInt(undefined, 20)).toBe(20);
        expect(readPositiveInt(0, 20)).toBe(20);
        expect(readPositiveInt(-5, 20)).toBe(20);
        expect(readPositiveInt('many', 20)).toBe(20);
    });
});

describe('bootstrap and JSON-LD extraction', () => {
    it('finds the bootstrap JSON path in page HTML', () => {
        const html = "<script>window.__BOOTSTRAP_URL__ = '/bootstrap/abc123.json';</script>";
        expect(extractBootstrapPath(html)).toBe('/bootstrap/abc123.json');
    });

    it('maps JSON-LD image objects to the image result shape', () => {
        const html = `
            <script type="application/ld+json">
            {
                "@context": "https://schema.org",
                "@type": "ImageObject",
                "contentUrl": "https://cdn.pixabay.com/photo/2024/09/09/15/10/birds-9035077_1280.jpg",
                "thumbnailUrl": "https://cdn.pixabay.com/photo/2024/09/09/15/10/birds-9035077_640.jpg",
                "acquireLicensePage": "/photos/birds-wildlife-9035077/",
                "name": "Free Birds Wildlife photo and picture"
            }
            </script>
        `;

        const [item] = parseJsonLdImages(html);

        expect(item.id).toBe(9035077);
        expect(item.mediaType).toBe('photo');
        expect(item.sources['1x']).toContain('_640.jpg');
        expect(item.sources['2x']).toContain('_1280.jpg');
        expect(item.href).toBe('/photos/birds-wildlife-9035077/');
    });
});

describe('payload parsing and filtering', () => {
    it('reads results and pagination metadata', () => {
        const payload = parseSearchPayload({
            page: { results: [{ id: 1 }], total: 250, pages: 3, perPage: 100 },
        });

        expect(payload).toEqual({ results: [{ id: 1 }], total: 250, pages: 3, perPage: 100 });
    });

    it('finds image records when the response shape shifts', () => {
        const payload = parseSearchPayload({
            data: {
                items: [{ id: 9, mediaType: 'photo', sources: { '2x': 'https://cdn.pixabay.com/photo/x.jpg' } }],
            },
        });

        expect(payload.results).toHaveLength(1);
        expect(payload.results[0].id).toBe(9);
    });

    it('returns undefined for an unrelated JSON body', () => {
        expect(parseSearchPayload({ request: {} })).toBeUndefined();
    });

    it('drops sponsored records and duplicate images', () => {
        const results = selectImageResults([
            { id: 1, mediaType: 'photo', sources: { '2x': 'https://cdn.pixabay.com/photo/a.jpg' } },
            { id: 1, mediaType: 'photo', sources: { '2x': 'https://cdn.pixabay.com/photo/a.jpg' } },
            { id: 'gm123', mediaType: 'getty_ad', sources: { '2x': 'https://example.com/ad.jpg' } },
            { id: 2, mediaType: 'illustration', sources: { '2x': 'https://cdn.pixabay.com/vector/b.png' } },
        ]);

        expect(results.map((result) => result.id)).toEqual([1, 2]);
    });
});

describe('dataset mapping', () => {
    it('creates absolute links, joined tags, and skips noisy fields', () => {
        const item = mapResult({
            id: 6514885,
            mediaType: 'photo',
            name: 'Path, Grass, Dike, Clouds',
            sources: {
                '1x': 'https://cdn.pixabay.com/photo/path-6514885_640.jpg',
                '2x': 'https://cdn.pixabay.com/photo/path-6514885_1280.jpg',
                downloadUrl: '/images/download/x-6514885_1920.jpg',
            },
            href: '/photos/path-grass-dike-clouds-6514885/',
            tagList: [
                ['Path', '/images/search/path/'],
                ['Grass', '/images/search/grass/'],
            ],
            tagLinks: '<a href=/images/search/path/>Path</a>',
            user: {
                id: 2849566,
                username: 'HelgaKa',
                profileUrl: '/users/helgaka-2849566/',
                socialLinks: [],
                donations: ['masked@example.com'],
                donation: { paypal: 'masked@example.com', method: 2 },
            },
            canvaRetouchUrl: 'https://www.canva.com/content-partner/',
            canvaCropImageUrl: 'https://www.canva.com/content-partner/crop',
        });

        expect(item.pageUrl).toBe('https://pixabay.com/photos/path-grass-dike-clouds-6514885/');
        expect(item.downloadUrl).toBe('https://pixabay.com/images/download/x-6514885_1920.jpg');
        expect(item.profileUrl).toBe('https://pixabay.com/users/helgaka-2849566/');
        expect(item.imageUrl_small).toContain('_640.jpg');
        expect(item.imageUrl_large).toContain('_1280.jpg');
        expect(item.tags).toBe('Path, Grass');
        expect(item.username).toBe('HelgaKa');
        expect(item.user_id).toBe(2849566);
        expect(item.canvaRetouchUrl).toBe('https://www.canva.com/content-partner/');
        expect(item.tagLinks).toBeUndefined();
        expect(item.canvaCropImageUrl).toBeUndefined();
        expect(item.user_donations_0).toBeUndefined();
        expect(item.user_donation_paypal).toBeUndefined();
    });
});

describe('challenge detection', () => {
    it('flags block statuses', () => {
        expect(detectChallenge(403, '')).toBe('HTTP 403');
        expect(detectChallenge(429, '')).toBe('HTTP 429');
    });

    it('flags Cloudflare and captcha pages', () => {
        expect(detectChallenge(200, '<title>Just a moment...</title>')).toBe('challenge page');
        expect(detectChallenge(200, 'Please verify you are human')).toBe('challenge page');
    });

    it('accepts a normal page', () => {
        expect(detectChallenge(200, '<html><title>Pixabay</title></html>')).toBeUndefined();
    });
});
