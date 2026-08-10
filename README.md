## What does Pixabay Image Scraper do?

Pixabay Image Scraper collects public Pixabay image search results from a keyword, an optional location context, or an existing Pixabay search URL. It returns image metadata, dimensions, tags, engagement counts, uploader information, quality flags, and image links in a dataset that is ready for research, content planning, cataloging, and creative workflows.

Use it when you need more than a list of image titles. Each result can include the source page, preview links, download link, creator profile, image type, and popularity metrics so you can review and analyze image candidates in one place.

## Why use Pixabay Image Scraper?

- **Build image research datasets** - Collect many Pixabay results without manually copying titles, links, tags, and creator information.
- **Plan visual content** - Create reference libraries for blog posts, social campaigns, presentations, websites, and design briefs.
- **Compare visual trends** - Review tags, media types, dimensions, likes, views, downloads, and editor's choice status for a search topic.
- **Support creator research** - Keep uploader names, profile links, active status, and hire availability alongside each image.
- **Automate downstream work** - Export the dataset as JSON, CSV, Excel, or XML, or connect completed runs to webhooks and other Apify integrations.

## What data can you extract from Pixabay?

The Actor saves one dataset item per unique image. Empty values are omitted, and repeated or incomplete image records are skipped.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Unique Pixabay image identifier |
| `mediaType` | String | Media type such as `photo`, `illustration`, or `vector` |
| `mediaDescriptiveType` | String | Human-readable media category |
| `width` | Integer | Image width in pixels |
| `height` | Integer | Image height in pixels |
| `uploadDate` | String | Upload timestamp when provided by Pixabay |
| `name` | String | Pixabay display name for the asset |
| `title` | String | Download-oriented title text |
| `alt` | String | Accessible alternative text |
| `description` | String | Image description when available |
| `pageUrl` | String | Full Pixabay page URL for the image |
| `imageUrl_small` | String | Smaller image URL |
| `imageUrl_large` | String | Larger image URL |
| `downloadUrl` | String | Full Pixabay download URL |
| `tags` | String | Comma-separated image tags |
| `likeCount` | Integer | Number of likes |
| `commentCount` | Integer | Number of comments |
| `viewCount` | Integer | Number of views |
| `downloadCount` | Integer | Number of downloads |
| `isEditorsChoice` | Boolean | Whether Pixabay marks the image as editor's choice |
| `isAiGenerated` | Boolean | Whether Pixabay marks the image as AI-generated |
| `nsfw` | Boolean | Whether the image is flagged as sensitive |
| `vector` | Boolean | Whether the result is a vector |
| `isLowQuality` | Boolean | Whether Pixabay marks the image as low quality |
| `qualityStatus` | Integer | Pixabay quality status code |
| `username` | String | Uploader username |
| `profileUrl` | String | Full Pixabay uploader profile URL |
| `user_id` | Integer | Uploader identifier |
| `user_avatarSrc` | String | Uploader avatar URL |
| `user_isAvailableForHire` | Boolean | Whether the uploader indicates hire availability |
| `user_isActive` | Boolean | Uploader activity status |
| `user_donation_paypal` | String | PayPal donation URL when provided |
| `canvaRetouchUrl` | String | Canva editing link when provided |

Pixabay may provide additional metadata. Nested values are flattened into field names with underscores, and only fields with usable values are saved.

## How to use Pixabay Image Scraper

1. Open the Actor on Apify Store.
2. Enter a `keyword`, or provide a complete Pixabay search URL in `url`.
3. Add `location` when you want the location included in the search phrase.
4. Set `results_wanted` and `max_pages` for the size of the run.
5. Optionally configure Apify Proxy for larger or less consistent runs.
6. Start the run and download the dataset or connect it to your workflow.

When both `url` and `startUrl` are provided, `startUrl` takes precedence. `startUrl` is supported as an alternate URL input for existing workflows.

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `keyword` | String | No | Empty | Search term such as `nature`, `sunset`, or `city skyline` |
| `location` | String | No | Empty | Additional search context such as `Tokyo` or `Pakistan` |
| `url` | String | No | Empty | Full Pixabay image search URL; takes priority over keyword input |
| `startUrl` | String | No | Empty | Alternate full Pixabay search URL; takes priority over `url` when provided |
| `results_wanted` | Integer | No | `20` | Maximum number of unique images to save; minimum is `1` |
| `max_pages` | Integer | No | `999` | Maximum number of result pages to process; minimum is `1` |
| `proxyConfiguration` | Object | No | Empty | Optional Apify Proxy settings for more reliable access |

If no keyword or URL is supplied, the Actor starts from the general Pixabay image search page. A URL should be a public Pixabay image-search page, not an individual image page.

## Usage Examples

### Basic Keyword Search

Collect 20 images for a general topic:

```json
{
  "keyword": "nature",
  "results_wanted": 20,
  "max_pages": 2
}
```

### Keyword With Location Context

Add a location to the search phrase for more specific visual research:

```json
{
  "keyword": "cherry blossom",
  "location": "Tokyo",
  "results_wanted": 40,
  "max_pages": 3
}
```

### Existing Pixabay Search URL

Continue from a known Pixabay image search page:

```json
{
  "url": "https://pixabay.com/images/search/mountain-landscape/",
  "results_wanted": 50,
  "max_pages": 4
}
```

## Sample Output

The following example shows one dataset item. Some fields are optional and appear only when Pixabay provides them.

```json
{
  "id": 7133867,
  "mediaType": "photo",
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
  "user_id": 4749850
}
```

The Actor returns links and metadata. It does not store the original image files in the dataset, so use the returned URLs when your workflow needs to retrieve an image.

## Tips for Best Results

- **Start with a small run** - Test a keyword or URL with `results_wanted: 20` before collecting a larger dataset.
- **Use focused terms** - Specific searches such as `minimal office desk` usually produce a more useful reference set than a broad term such as `office`.
- **Add location context carefully** - Use `location` when geography matters, but remember that it becomes part of the search phrase rather than a strict geographic filter.
- **Set a page limit** - Increase `max_pages` when you need deeper results, and keep it lower for quick validation runs.
- **Use a complete search URL** - Existing Pixabay URLs are useful when you want to preserve the search page and its query context.
- **Review licensing before reuse** - Check the current Pixabay terms and the rights for each asset before publishing, reselling, or redistributing an image.

## Integrations and Export Formats

- **Google Sheets** - Review image candidates, tags, dimensions, and engagement metrics in a spreadsheet.
- **Airtable** - Build a searchable visual asset library with creator and source links.
- **Webhooks** - Send completed run notifications and dataset references to another service.
- **Make or Zapier** - Route new image records into content planning and reporting workflows.
- **API access** - Read the dataset from your own application after a run completes.

Apify datasets can be downloaded in JSON, CSV, Excel, XML, and other supported formats.

## Frequently Asked Questions

### Can I search Pixabay with a keyword or a URL?

Yes. Use `keyword` for a new search or `url` for an existing Pixabay image search page. The alternate `startUrl` input is also supported, and it takes precedence when supplied.

### Does the Actor remove duplicate images?

Yes. The Actor uses stable image information to avoid saving the same result twice across pages.

### Does the Actor download image files?

No. It saves image and download URLs with the metadata, allowing your own workflow to retrieve files when needed.

### How many images can I collect?

The Actor collects up to `results_wanted` unique images, subject to the available search results and `max_pages` limit.

### Why are some fields missing?

Fields are omitted when Pixabay does not provide a value for a result. This is expected for optional descriptions, creator details, quality flags, and links.

### Can I export Pixabay data to CSV or Excel?

Yes. Download the dataset from Apify in CSV, Excel, JSON, XML, or another supported format.

### Is it legal to collect Pixabay data?

Public availability does not remove your legal responsibilities. Follow Pixabay's current terms, licensing requirements, copyright rules, privacy obligations, and applicable laws for your use case.

## Related Actors

- [Unsplash Image Scraper](https://apify.com/shahidirfan/unsplash-image-scraper) - Collect image metadata, download URLs, photographer details, dimensions, colors, and likes from Unsplash.
- [Pexels Stock Image Scraper](https://apify.com/shahidirfan/pexels-stock-image-scraper) - Gather Pexels image links, titles, dimensions, tags, colors, photographer information, and search context.

## Support

For issues, feature requests, or missing fields, use the Issues tab on the Actor page or contact the developer through Apify. Include the input used and a sample result when reporting a problem.

## Legal Notice

This Actor is intended for legitimate collection of publicly available image-search data. Users are responsible for complying with Pixabay terms, image licenses, copyright rules, privacy requirements, and applicable laws. Do not assume that a returned image can be used for every commercial or editorial purpose without checking its rights.
