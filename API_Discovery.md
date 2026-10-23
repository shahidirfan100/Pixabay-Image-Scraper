# Pixabay Image Search API Discovery

This file is the starting point for every failure investigation. Read it before changing the request flow.

Last verified: 2026-10-23. All status codes and record counts below came from live requests against `pixabay.com` using the installed `impit` version.

## Selected API

- Endpoint: `GET https://pixabay.com/images/search/<query>/?pagi=<page>`
- Response: `application/json` when the request asks for the bootstrap payload
- Auth: none
- Cookies: none required. `g_rated=1` is sent as a safe-search preference.
- Pagination: `pagi` query parameter, starting at `1`
- Page size: about 106 raw records per page, including one sponsored `getty_ad`
- Useful image records: about 105 per page after filtering sponsored entries

Required request headers:

```http
Accept: application/json
x-fetch-bootstrap: 1
x-bootstrap-cache-miss: 1
Referer: https://pixabay.com/images/search/<query>/
Cookie: g_rated=1
```

Do not set `User-Agent`, `sec-ch-ua`, `sec-fetch-*`, or `Accept-Language` by hand. The `impit` browser profile generates a coherent set of values for each request.

## Available Fields

The JSON payload has a top-level `request` object and a `page` object. Each item in `page.results` contains:

`id`, `mediaType`, `mediaSubType`, `mediaDescriptiveType`, `sources.1x`, `sources.2x`, `sources.downloadUrl`, `nsfw`, `isAiGenerated`, `width`, `height`, `uploadDate`, `href`, `alt`, `title`, `description`, `name`, `tagList`, `likeCount`, `commentCount`, `vector`, `isEditorsChoice`, `isLowQuality`, `qualityStatus`, `user.id`, `user.username`, `user.avatarSrc`, `user.profileUrl`, `user.donation`, `user.isActive`, `user.isAvailableForHire`, `viewCount`, `downloadCount`, `canvaRetouchUrl`.

`page` also contains `total`, `pages`, `perPage`, `page`, `order`, `safesearch`, `orientation`, `contentType`, `colors`, and `date`.

The actor maps the useful fields to a flat dataset item and keeps the existing `pageUrl`, `imageUrl_small`, `imageUrl_large`, `downloadUrl`, `profileUrl`, `tags`, and `username` names.

## Profile Matrix

All 23 browser profiles exposed by `impit@0.14.7` were tested against page 1 of the `nature` search. A pass means HTTP 200, `application/json`, and 106 parsed records.

| Profile      | Result | Records |
| ------------ | ------ | ------: |
| `chrome`     | Pass   |     106 |
| `chrome151`  | Pass   |     106 |
| `chrome142`  | Pass   |     106 |
| `chrome136`  | Pass   |     106 |
| `chrome131`  | Pass   |     106 |
| `chrome125`  | Pass   |     106 |
| `chrome124`  | Pass   |     106 |
| `chrome116`  | 403    |       0 |
| `chrome110`  | 403    |       0 |
| `chrome107`  | 403    |       0 |
| `chrome104`  | 403    |       0 |
| `chrome101`  | 403    |       0 |
| `chrome100`  | 403    |       0 |
| `firefox`    | Pass   |     106 |
| `firefox144` | Pass   |     106 |
| `firefox135` | Pass   |     106 |
| `firefox133` | Pass   |     106 |
| `firefox128` | Pass   |     106 |
| `ios18`      | Pass   |     106 |
| `okhttp`     | Pass   |     106 |
| `okhttp3`    | Pass   |     106 |
| `okhttp4`    | Pass   |     106 |
| `okhttp5`    | Pass   |     106 |

Selected recovery order: `chrome151`, `chrome142`, `chrome136`, `chrome124`, `chrome`, `firefox`, `firefox144`, `firefox135`, `ios18`, `okhttp5`.

Legacy Chrome profiles 100 through 116 are rejected with 403 and are not used.

There is no separate mobile API. The `ios18`, `okhttp`, and modern Chrome profiles all receive the same website JSON payload. The mobile profiles are therefore useful as block-recovery profiles, not as a separate data source.

## Header and Parameter Tests

| Test                                    | Result                                              |
| --------------------------------------- | --------------------------------------------------- |
| JSON headers plus `g_rated=1`           | 200, 106 records                                    |
| JSON headers with an empty cookie value | 200, 106 records                                    |
| `x-bootstrap-cache-miss: 0`             | 200, 106 records                                    |
| Plain HTML request with modern Chrome   | 200, Pixabay search page, 100 JSON-LD image objects |
| `order=latest`                          | 200, 106 records                                    |
| `orientation=horizontal`                | 200, 106 records, `pages` reduced to 12,688         |
| `category=photos`                       | 200, 106 records                                    |
| `colors=red`                            | 200, 106 records, `pages` reduced to 24             |
| `content_type=authentic`                | 200, 106 records, `pages` reduced to 14,018         |
| `date=1w`                               | 200, 106 records, `pages` reduced to 7              |

Supplied search URLs keep their existing filter parameters. Only `pagi` is removed and rebuilt by the actor.

## Pagination

- Page 1 through page 9999 all returned HTTP 200 with a non-empty result set.
- Each tested page returned a distinct first record, so the parameter is not clamped to page 1.
- Stop from `page.pages`, not from a hardcoded maximum. The `nature` search reported 15,154 pages.
- The actor also stops after three consecutive pages without a new usable image, or when `max_pages` / `results_wanted` is reached.

## Sponsored Records

The result array includes a `getty_ad` record with a string id and an external `mediaType`. The actor filters results to `photo`, `illustration`, `vector`, and `gif`, so sponsored entries never reach the dataset.

## Extraction Fallbacks

The actor uses three levels, in order:

1. **JSON content negotiation** - the primary path described above.
2. **Page bootstrap** - request the search page as HTML, read `window.__BOOTSTRAP_URL__`, then request `/bootstrap/<hash>.json`. That endpoint returned `200 application/json` with 106 records.
3. **Embedded JSON-LD** - parse `ImageObject` entries from the HTML page. The page contained 100 objects with `contentUrl`, `thumbnailUrl`, `acquireLicensePage`, and `name`. This path has fewer fields and is used only when the first two paths fail.

`window.__BOOTSTRAP__` is currently `undefined` in the page source. `window.__BOOTSTRAP_URL__` is present and is the usable bootstrap reference.

## Failure Diagnosis Order

When the actor fails, follow this order before changing code:

1. Read this file and identify the last known working flow, headers, and profile list.
2. Reproduce one page with a single `impit` request. Record the status, content type, body length, and whether the body is JSON, HTML, or a challenge page.
3. **HTTP 403 or 429** - treat it as a profile or rate-limit problem. Honor `Retry-After`, rotate to the next profile in the recovery order, and do not retry the same blocked profile indefinitely.
4. **HTML returned where JSON was expected** - the content negotiation headers or session behavior changed. Use the page bootstrap fallback and check whether `window.__BOOTSTRAP_URL__` moved or was renamed.
5. **HTTP 200 JSON without `page.results`** - the response shape changed. Inspect the top-level keys, then extend the tolerant array lookup in `parseSearchPayload`. Do not dump the response body into logs.
6. **Bootstrap URL returns 404** - the hash endpoint was retired. Keep the JSON-LD fallback and look for a new bootstrap variable in the page HTML.
7. **All paths fail from one machine** - compare against the profile matrix and try a current Chrome, Firefox, iOS, or okhttp profile. If every modern profile fails, re-run the matrix before editing the actor.
8. Update this file with the new evidence, including the profile, headers, status, and field names that worked.

Never hardcode a token, cookie, user agent, or bootstrap hash. Never add an unverified endpoint. Recovery must stay bounded and evidence-based.

## Implementation Notes

- The request client is `impit`; no browser is used.
- One client is created per profile and reused. The client keeps cookies and connections for that profile.
- Each profile gets its own proxy URL when a proxy is configured, so a blocked profile can rotate to a different exit.
- The engine retries temporary statuses (`408`, `425`, `429`, `5xx`) and network errors up to two times with bounded backoff.
- The engine then rotates profile and extraction strategy. The first working combination is pinned for the rest of the run.
- A valid empty search (`total: 0`) finishes successfully with an empty dataset. A blocked or malformed response fails the run when no data has been saved.
- Records are pushed page by page. A later page failure stops the run with the saved partial dataset instead of discarding earlier results.

## Cloud Run Evidence

Verified on 2026-10-23 with build `2.0.2`:

- Input: `{"keyword":"nature"}` (the store health-test input built from the single prefill)
- `chrome/json`: HTTP 403
- `chrome/html`: HTTP 403
- `chrome151/json`: HTTP 200
- Result: `SUCCEEDED`, 20 unique photo records, no sponsored records, no donation PII
- Stop reason: `target_reached`

The Apify cloud IP rejects the default `chrome` profile while `chrome151` passes. Profile rotation is required on the platform, not just a theoretical fallback. After moving `chrome151` to the front of the recovery order, build `2.0.3` (run `jeiptNsNyvR2dzdWk`) succeeded on the first request with `chrome151/json`.

Build note: `apify/actor-node:22` ships npm 10, whose arborist crashes on this dependency tree with `Cannot read properties of null (reading 'edgesOut')`. The project `.npmrc` sets `legacy-peer-deps=true`, and the Dockerfile copies `.npmrc` before `npm install`. Without that file, the container build fails before the actor starts.

## Rejected Sources

| Source                 | Reason                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Official Pixabay API   | Requires an API key, and the actor input contract does not collect one.                                           |
| `window.__BOOTSTRAP__` | Present as a variable name but currently `undefined`.                                                             |
| HTML DOM card scraping | Not needed while JSON and JSON-LD are available.                                                                  |
| Browser automation     | The JSON endpoint works over plain HTTP with modern profiles, so a browser only adds startup time and image size. |
| Legacy Chrome profiles | Blocked with 403.                                                                                                 |
