# Pixabay API Discovery Report

## Target Website
**URL:** `https://pixabay.com/images/search/nature/`

## API Endpoints Discovered

### 1. Bootstrap API (Primary — Used by Actor)

**Endpoint:** `https://pixabay.com/bootstrap/{hash}.json`

**Discovery Method:** Browser network analysis — Pixabay embeds a hash-based URL in the page source as `window.__BOOTSTRAP_URL__`. This JSON endpoint returns the full search results data.

**Authentication:** Requires browser session cookies (Cloudflare-protected). The actor uses Patchright Chrome to load the page, clear CF challenge, then fetches this API directly from within the browser context using `page.evaluate(fetch(...))`.

**Request:**
```
GET https://pixabay.com/bootstrap/{hash}.json
Headers: Accept: application/json, credentials: same-origin
```

**Response Structure:**
```json
{
  "page": {
    "results": [
      {
        "id": 7373484,
        "name": "Landscape Nature Background",
        "mediaType": "photo",
        "width": 6000,
        "height": 4000,
        "sources": {
          "1x": "https://cdn.pixabay.com/photo/.../image_1280.jpg",
          "2x": "https://cdn.pixabay.com/photo/.../image_1920.jpg",
          "downloadUrl": "/get/..."
        },
        "tagList": ["landscape", "nature", "background"],
        "likeCount": 142,
        "viewCount": 18234,
        "downloadCount": 89,
        "commentCount": 5,
        "isEditorsChoice": false,
        "isAiGenerated": false,
        "nsfw": false,
        "uploadDate": "2022-08-08",
        "user": {
          "username": "photographer_name",
          "profileUrl": "/users/photographer_name/"
        }
      }
    ],
    "pages": 50,
    "total": 5000
  }
}
```

**Pagination:** `?pagi=N` query parameter on the search URL (e.g., `?pagi=2` for page 2).

### 2. JSON-LD Structured Data (Fallback)

**Type:** `application/ld+json` script tags in HTML

**Schema:** `ImageObject` (schema.org)

**Fields Available:** `name`, `contentUrl`, `thumbnailUrl`, `acquireLicensePage`

**Note:** Limited data (no dimensions, tags, engagement metrics). Used only when bootstrap API is unavailable.

## Data Fields Extracted

| Field | Source | Description |
|-------|--------|-------------|
| `id` | Bootstrap API | Unique image ID |
| `title` | `name` field | Image title |
| `mediaType` | Bootstrap API | photo, illustration, etc. |
| `width` | Bootstrap API | Width in pixels |
| `height` | Bootstrap API | Height in pixels |
| `imageUrl_small` | `sources.1x` | Small resolution URL |
| `imageUrl_large` | `sources.2x` | Large resolution URL |
| `downloadUrl` | `sources.downloadUrl` | Direct download URL |
| `tags` | `tagList` array | Comma-separated tags |
| `likes` | `likeCount` | Number of likes |
| `comments` | `commentCount` | Number of comments |
| `views` | `viewCount` | Number of views |
| `downloads` | `downloadCount` | Number of downloads |
| `editorsChoice` | `isEditorsChoice` | Editor's pick flag |
| `aiGenerated` | `isAiGenerated` | AI-generated flag |
| `uploadDate` | Bootstrap API | Upload date |
| `username` | `user.username` | Uploader username |
| `profileUrl` | `user.profileUrl` | Uploader profile link |
| `pageUrl` | Constructed from ID | Pixabay page URL |

## Anti-Bot Protection

**Cloudflare:** Pixabay uses Cloudflare challenge pages to protect the bootstrap API. Direct HTTP requests (gotScraping, fetch, curl) receive `403 Forbidden` with `cf-mitigated: challenge`.

**Bypass Method:** Patchright Chrome (patched Playwright fork) loads the page in a real browser, which auto-resolves the CF challenge. The bootstrap API is then fetched from within the browser context using the established CF session cookies.

## Blocking Patterns Observed

- Direct HTTP to bootstrap URL → 403 (Cloudflare challenge)
- `window.__BOOTSTRAP__` is `undefined` for some search terms (data not embedded inline)
- `window.__BOOTSTRAP_URL__` is always present in page source
