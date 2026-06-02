# Pixabay Image Scraper

Extract rich Pixabay image search results with metadata that goes beyond basic titles and URLs. Collect image details, search result metrics, uploader information, download links, and quality flags in a clean dataset for research, trend tracking, and content planning.

## Features

- **Structured Result Extraction** — Collects data from Pixabay's structured search payload instead of relying on brittle card parsing
- **Richer Metadata** — Returns image dimensions, engagement counts, descriptive fields, uploader details, and quality indicators
- **Duplicate Protection** — Skips repeated records across pages using stable image identifiers
- **Clean Output** — Omits null, empty, and incomplete records before saving to the dataset
- **Flexible Search Input** — Supports keyword search, location-enhanced search terms, and direct Pixabay search URLs
- **Pagination Control** — Stops at your requested image count or page limit

## Use Cases

### Visual Trend Research
Track which styles, subjects, and image types are popular for a keyword. Use engagement counts, tags, and descriptive metadata to compare search trends over time.

### Content Planning
Build reference collections for blog posts, social campaigns, or design work. Search by topic and keep direct image links, download paths, and creator details together.

### Dataset Creation
Create structured datasets for analysis, tagging workflows, or internal cataloging. The output includes both image-level fields and uploader-level context.

### Creative Market Monitoring
Review result pages for quality signals such as editor's choice flags, AI-generated labels, media type, and result volume to understand the current image landscape.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | String | No | — | Full Pixabay search URL to scrape. Takes priority over keyword input. |
| `keyword` | String | No | — | Search term such as `nature`, `sunset`, or `city skyline`. |
| `location` | String | No | — | Extra search context appended to the keyword, such as `Tokyo` or `Pakistan`. |
| `results_wanted` | Integer | No | `20` | Maximum number of unique images to collect. |
| `max_pages` | Integer | No | `10` | Maximum number of result pages to visit. |
| `proxyConfiguration` | Object | No | — | Proxy settings for more reliable access when needed. |

---

## Output Data

Each dataset item can contain:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | Unique Pixabay image ID |
| `mediaType` | String | Media type such as photo, illustration, or vector |
| `mediaSubType` | Number | Pixabay media subtype code |
| `mediaDescriptiveType` | String | Human-readable media category |
| `width` | Number | Image width in pixels |
| `height` | Number | Image height in pixels |
| `uploadDate` | String | Upload timestamp returned by Pixabay |
| `name` | String | Pixabay display name for the asset |
| `title` | String | Download-oriented title text |
| `alt` | String | Accessible alt text from the search result |
| `description` | String | Description text when available |
| `pageUrl` | String | Direct Pixabay page URL for the image |
| `href` | String | Original relative page path |
| `imageUrl_small` | String | Smaller image URL |
| `imageUrl_large` | String | Larger image URL |
| `downloadUrl` | String | Download path expanded to a full URL |
| `tags` | String | Comma-separated keyword tags |
| `likeCount` | Number | Number of likes |
| `commentCount` | Number | Number of comments |
| `viewCount` | Number | Number of views |
| `downloadCount` | Number | Number of downloads |
| `isEditorsChoice` | Boolean | Whether Pixabay marks the asset as editor's choice |
| `isAiGenerated` | Boolean | Whether the asset is marked as AI-generated |
| `nsfw` | Boolean | Whether the asset is flagged as sensitive |
| `vector` | Boolean | Whether the asset is a vector |
| `isLowQuality` | Boolean | Quality warning flag |
| `qualityStatus` | Number | Pixabay quality status code |
| `username` | String | Uploader username |
| `profileUrl` | String | Full uploader profile URL |
| `user_id` | Number | Uploader ID |
| `user_avatarSrc` | String | Uploader avatar image URL |
| `user_isAvailableForHire` | Boolean | Hire availability flag |
| `user_isActive` | Boolean | Uploader active status |
| `user_donation_paypal` | String | Donation URL when provided |
| `canvaRetouchUrl` | String | Edit-in-Canva link when available |

---

## Usage Examples

### Basic Keyword Search

```json
{
    "keyword": "nature",
    "results_wanted": 20,
    "max_pages": 2
}
```

### Search With Extra Context

```json
{
    "keyword": "cherry blossom",
    "location": "Tokyo",
    "results_wanted": 40,
    "max_pages": 3
}
```

### Existing Pixabay Search URL

```json
{
    "url": "https://pixabay.com/images/search/mountain-landscape/",
    "results_wanted": 50,
    "max_pages": 4
}
```

---

## Sample Output

```json
{
    "id": 7133867,
    "mediaType": "photo",
    "mediaSubType": 1,
    "mediaDescriptiveType": "photo",
    "width": 3150,
    "height": 2100,
    "uploadDate": "2026-06-02T10:22:48.283309",
    "name": "Sunset, Sand, Beach, Islands",
    "title": "Download free HD stock image of Sunset Sand",
    "alt": "Free Sunset Sand photo and picture",
    "pageUrl": "https://pixabay.com/photos/sunset-sand-beach-islands-leaf-7133867/",
    "imageUrl_small": "https://cdn.pixabay.com/photo/2022/04/15/07/58/sunset-7133867_640.jpg",
    "imageUrl_large": "https://cdn.pixabay.com/photo/2022/04/15/07/58/sunset-7133867_1280.jpg",
    "downloadUrl": "https://pixabay.com/images/download/x-7133867_1920.jpg",
    "tags": "Sunset, Sand, Beach",
    "likeCount": 875,
    "commentCount": 144,
    "viewCount": 415881,
    "downloadCount": 376185,
    "isEditorsChoice": true,
    "isAiGenerated": false,
    "username": "Kanenori",
    "profileUrl": "https://pixabay.com/users/kanenori-4749850/",
    "user_id": 4749850,
    "user_avatarSrc": "https://cdn.pixabay.com/user/2023/03/30/07-49-26-304_96x96.jpg",
    "canvaRetouchUrl": "https://canva.com/content-partner/?utm_medium=partner&utm_source=pixabay&utm_campaign=retouch_in_canva_edit_image&image-url=https%3A//pixabay.com/get/g6f4b1d4e20e2b5841de54991192c08a9aed5c39d4ab77f74e4d07e79408e8edd51ccb1a4df4784ab45c3280aff3d94ae_1920.jpg%3Flonglived%3D&external-id=7133867&canva-media-id="
}
```

---

## Tips for Best Results

### Start With Smaller Runs

- Use `results_wanted: 20` to validate a search quickly
- Increase the limit after confirming the keyword or URL returns the right assets

### Use Focused Search Terms

- Specific topics usually return cleaner datasets than broad one-word searches
- Add `location` when you want geographic context included in the search

### Set Reasonable Page Limits

- Each page can contain many records, so a small `max_pages` value is often enough
- The actor stops automatically once the requested number of unique items is reached

---

## Integrations

Connect your data with:

- **Google Sheets** — Review tags, creators, and engagement data in a spreadsheet
- **Airtable** — Build searchable reference libraries for creative work
- **Webhooks** — Send results to downstream systems automatically
- **Make** — Trigger enrichment or reporting workflows
- **Zapier** — Route new records into business tools

### Export Formats

- **JSON** — For applications and automation
- **CSV** — For spreadsheet analysis
- **Excel** — For reporting and sharing
- **XML** — For system integrations

---

## Frequently Asked Questions

### Does the actor skip duplicate records?

Yes. Records are deduplicated before saving so repeated items across pages are not written to the dataset twice.

### What happens when a field is empty?

Empty, null, and incomplete values are filtered out automatically, so the dataset stays cleaner and easier to use.

### Can I scrape using a Pixabay URL instead of a keyword?

Yes. Provide a Pixabay search URL through `url` or `startUrl` and the actor will continue pagination from that search.

### How many results can I collect?

You can collect up to the limit set in `results_wanted`, subject to the available search results and your `max_pages` setting.

### Are uploader details included?

Yes. The dataset can include uploader usernames, profile URLs, avatar URLs, and some availability or donation fields when Pixabay provides them.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for ensuring compliance with Pixabay terms and applicable laws when collecting and using data.
