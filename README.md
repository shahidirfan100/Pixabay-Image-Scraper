## What does Pixabay Image Scraper do?

Pixabay Image Scraper collects public Pixabay image search results from a keyword, an optional location context, or an existing Pixabay search URL. Each dataset item includes the image page, preview and download links, dimensions, tags, creator details, and engagement counts. Use the dataset for image research, content planning, cataloging, or a creative reference library.

Use it when you need more than a list of image titles. A run can collect hundreds of results with source pages, preview links, download links, creator profiles, image types, and popularity metrics, so you can compare candidates in one place instead of opening each page.

## Why use Pixabay Image Scraper?

A keyword search returns a reusable reference set with the metadata needed to judge each image: dimensions, tags, likes, views, downloads, editor's choice status, AI-generated status, and creator details. The same dataset works for content planning, mood boards, design briefs, and creator research.

When Pixabay blocks a request, the Actor retries and changes its request profile instead of ending the run. It keeps the first path that works and pushes records page by page, so a late failure does not discard earlier results.

## What data can you extract from Pixabay?

The Actor saves one dataset item per unique image. Empty values are omitted, and repeated or incomplete image records are skipped.

| Field                     | Type    | Description                                             |
| ------------------------- | ------- | ------------------------------------------------------- |
| `id`                      | Integer | Unique Pixabay image identifier                         |
| `mediaType`               | String  | Media type such as `photo`, `illustration`, or `vector` |
| `mediaDescriptiveType`    | String  | Human-readable media category                           |
| `width`                   | Integer | Image width in pixels                                   |
| `height`                  | Integer | Image height in pixels                                  |
| `uploadDate`              | String  | Upload timestamp when provided by Pixabay               |
| `name`                    | String  | Pixabay display name for the asset                      |
| `title`                   | String  | Download-oriented title text                            |
| `alt`                     | String  | Accessible alternative text                             |
| `description`             | String  | Image description when available                        |
| `pageUrl`                 | String  | Full Pixabay page URL for the image                     |
| `imageUrl_small`          | String  | Smaller image URL                                       |
| `imageUrl_large`          | String  | Larger image URL                                        |
| `downloadUrl`             | String  | Full Pixabay download URL                               |
| `tags`                    | String  | Comma-separated image tags                              |
| `likeCount`               | Integer | Number of likes                                         |
| `commentCount`            | Integer | Number of comments                                      |
| `viewCount`               | Integer | Number of views                                         |
| `downloadCount`           | Integer | Number of downloads                                     |
| `isEditorsChoice`         | Boolean | Whether Pixabay marks the image as editor's choice      |
| `isAiGenerated`           | Boolean | Whether Pixabay marks the image as AI-generated         |
| `nsfw`                    | Boolean | Whether the image is flagged as sensitive               |
| `vector`                  | Boolean | Whether the result is a vector                          |
| `isLowQuality`            | Boolean | Whether Pixabay marks the image as low quality          |
| `qualityStatus`           | Integer | Pixabay quality status code                             |
| `username`                | String  | Uploader username                                       |
| `profileUrl`              | String  | Full Pixabay uploader profile URL                       |
| `user_id`                 | Integer | Uploader identifier                                     |
| `user_avatarSrc`          | String  | Uploader avatar URL                                     |
| `user_isAvailableForHire` | Boolean | Whether the uploader indicates hire availability        |
| `user_isActive`           | Boolean | Uploader activity status                                |
| `canvaRetouchUrl`         | String  | Canva editing link when provided                        |

Pixabay may provide additional metadata. Nested values are flattened into field names with underscores, and only fields with usable values are saved.

## How to use Pixabay Image Scraper

1. Open the Actor on Apify Store.
2. Enter a `keyword`, or provide a complete Pixabay search URL in `url`. The form starts with `nature` as an example.
3. Add `location` when you want the location included in the search phrase.
4. Set `results_wanted` and `max_pages` for the size of the run.
5. Optionally configure Apify Proxy for larger or less consistent runs.
6. Start the run and download the dataset or connect it to your workflow.

When both `url` and `startUrl` are provided, `startUrl` takes precedence. `startUrl` is supported as an alternate URL input for existing workflows. A supplied URL runs on its own; the keyword and location are ignored so the two search modes do not mix.

## Input Parameters

| Parameter            | Type    | Required | Default  | Description                                                                |
| -------------------- | ------- | -------- | -------- | -------------------------------------------------------------------------- |
| `keyword`            | String  | No       | `nature` | Search term such as `nature`, `sunset`, or `city skyline`                  |
| `location`           | String  | No       | Empty    | Additional search context such as `Tokyo` or `Pakistan`                    |
| `url`                | String  | No       | Empty    | Full Pixabay image search URL; takes priority over keyword input           |
| `startUrl`           | String  | No       | Empty    | Alternate full Pixabay search URL; takes priority over `url` when provided |
| `results_wanted`     | Integer | No       | `20`     | Maximum number of unique images to save; minimum is `1`                    |
| `max_pages`          | Integer | No       | `10`     | Maximum number of result pages to process; minimum is `1`                  |
| `proxyConfiguration` | Object  | No       | Empty    | Optional Apify Proxy settings for more reliable access                     |

If no keyword or URL is supplied, the Actor runs the default `nature` search. A URL should be a public Pixabay image-search page, not an individual image page.

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

## Tips for best results

Start with `results_wanted: 20` to check the output before a larger run. Specific terms such as `minimal office desk` usually return a tighter set than broad terms such as `office`. Use `location` when geography matters, but remember that it becomes part of the search phrase, not a strict geographic filter. Increase `max_pages` for deeper results and keep it low for quick checks. A complete search URL preserves the filters and query context you already selected. Check the current Pixabay terms and each image license before publishing, reselling, or redistributing an asset.

## Integrations and export formats

The dataset downloads as JSON, CSV, Excel, or XML. Send a finished run to Google Sheets, Airtable, Make, Zapier, or a webhook when the records need to move into another workflow. You can also read the dataset through the Apify API after a run completes.

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

### What happens when Pixabay blocks a request?

The Actor retries temporary errors, then changes its browser profile and extraction path. It keeps the first path that works for the rest of the run. If every path fails before any image is saved, the run fails with a clear error instead of returning an empty dataset.

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
