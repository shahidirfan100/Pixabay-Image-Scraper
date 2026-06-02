# Pixabay Image Scraper

Extract high-quality images from Pixabay with ease. Collect image data including titles, URLs, tags, dimensions, and engagement metrics at scale. Perfect for stock photo research, content planning, visual trend analysis, and building curated image datasets.

## Features

- **Keyword Search** — Find images by keyword, location, or any search term
- **URL-Based Extraction** — Scrape from any existing Pixabay search URL
- **Pagination Support** — Automatically collects across multiple pages to reach your desired count
- **Rich Image Data** — Captures titles, image URLs, tags, dimensions, likes, views, downloads, and more
- **Deduplication** — Each image is collected once with unique ID tracking
- **Flexible Limits** — Control maximum images and pages to suit your needs

## Use Cases

### Stock Photo Research
Analyze popular images, tags, and engagement metrics to identify trending visual content. Understand what types of images perform best and discover gaps in available stock photography.

### Content Planning
Build collections of reference images for blog posts, social media campaigns, or creative projects. Gather visual inspiration organized by topic with direct image URLs.

### Visual Trend Analysis
Track image popularity over time using likes, views, and download counts. Identify emerging visual trends across categories and keywords for data-driven creative decisions.

### AI and ML Training Data
Collect labeled image datasets with metadata including tags, dimensions, and upload dates. Build structured datasets for training image classification or tagging models.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | String | No | — | Full Pixabay search URL to scrape (overrides keyword) |
| `keyword` | String | No | — | Search keyword, e.g. "nature", "sunset", "city skyline" |
| `location` | String | No | — | Location to append to search, e.g. "Tokyo", "New York" |
| `results_wanted` | Integer | No | `100` | Maximum number of images to collect |
| `max_pages` | Integer | No | `10` | Maximum number of pages to scrape (~100 images per page) |
| `proxyConfiguration` | Object | No | — | Proxy settings (Apify Residential recommended) |

---

## Output Data

Each item in the dataset contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | Unique Pixabay image ID |
| `title` | String | Image title |
| `mediaType` | String | Media type (photo, illustration, etc.) |
| `width` | Number | Image width in pixels |
| `height` | Number | Image height in pixels |
| `imageUrl_small` | String | Small/1x resolution image URL |
| `imageUrl_large` | String | Large/2x resolution image URL |
| `downloadUrl` | String | Direct download URL |
| `tags` | String | Comma-separated tags |
| `likes` | Number | Number of likes |
| `comments` | Number | Number of comments |
| `views` | Number | Number of views |
| `downloads` | Number | Number of downloads |
| `editorsChoice` | Boolean | Whether marked as editor's choice |
| `aiGenerated` | Boolean | Whether AI-generated |
| `uploadDate` | String | Date the image was uploaded |
| `username` | String | Uploader's username |
| `profileUrl` | String | Link to uploader's profile |
| `pageUrl` | String | Direct link to the image page on Pixabay |

---

## Usage Examples

### Basic Keyword Search

Collect 10 nature images:

```json
{
    "keyword": "nature",
    "results_wanted": 10,
    "max_pages": 1
}
```

### Search by URL

Scrape images from an existing Pixabay search URL:

```json
{
    "url": "https://pixabay.com/images/search/sunset/",
    "results_wanted": 50,
    "max_pages": 3
}
```

### Keyword with Location

Search for images with a location filter:

```json
{
    "keyword": "cherry blossom",
    "location": "Tokyo",
    "results_wanted": 100,
    "max_pages": 5
}
```

### Large Collection

Collect up to 500 images across many pages:

```json
{
    "keyword": "mountain landscape",
    "results_wanted": 500,
    "max_pages": 10
}
```

---

## Sample Output

```json
{
    "id": 7373484,
    "title": "Landscape Nature Background",
    "mediaType": "photo",
    "width": 6000,
    "height": 4000,
    "imageUrl_small": "https://cdn.pixabay.com/photo/2022/08/08/19/36/landscape-7373484_1280.jpg",
    "imageUrl_large": "https://cdn.pixabay.com/photo/2022/08/08/19/36/landscape-7373484_1280.jpg",
    "tags": "landscape, nature, background, tropical, rainbow",
    "likes": 142,
    "views": 18234,
    "downloads": 89,
    "uploadDate": "2022-08-08",
    "username": "photographer_name",
    "pageUrl": "https://pixabay.com/photos/landscape-rainbow-tropical-atoll-7373484/"
}
```

---

## Tips for Best Results

### Start Small for Testing
- Begin with `results_wanted: 10` and `max_pages: 1` to verify your search
- Increase limits once you confirm the results match your needs

### Use Specific Keywords
- Combine keywords for better results, e.g. "golden hour beach sunset"
- Add location filters to narrow geographic results

### Choose the Right Proxy
- Residential proxies are recommended for reliable access
- Set `proxyConfiguration` with Apify Residential proxy group

### Handle Large Collections
- Each page returns approximately 100 images
- Set `max_pages` accordingly for your target count
- The scraper stops automatically when `results_wanted` is reached

---

## Integrations

Connect your data with:

- **Google Sheets** — Export for analysis and sharing
- **Airtable** — Build searchable image databases
- **Slack** — Get notifications when scraping completes
- **Webhooks** — Send results to custom endpoints
- **Make** — Create automated workflows with image data
- **Zapier** — Trigger actions based on new results

### Export Formats

Download data in multiple formats:

- **JSON** — For developers and APIs
- **CSV** — For spreadsheet analysis
- **Excel** — For business reporting
- **XML** — For system integrations

---

## Frequently Asked Questions

### How many images can I collect?
You can collect up to all available search results. Pixabay typically returns thousands of results for popular keywords. Set `results_wanted` to control the limit.

### Can I search by category or color?
This scraper supports keyword-based and URL-based search. For category or color filtering, use Pixabay's website to build the URL first, then pass it as the `url` parameter.

### What if some fields are missing?
Some fields (like likes, views, downloads) may be absent if the source doesn't provide them. The scraper only includes fields with actual values — no null or empty fields.

### Does the scraper handle pagination automatically?
Yes. The scraper automatically navigates through pages until it reaches your `results_wanted` limit or `max_pages` cap.

### Can I scrape a specific photographer's images?
Yes. Navigate to a photographer's page on Pixabay, copy the URL, and provide it as the `url` input parameter.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for ensuring compliance with Pixabay's terms of service and applicable laws. Use data responsibly and respect rate limits.
