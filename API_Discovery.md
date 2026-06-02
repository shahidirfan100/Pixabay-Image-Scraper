## Selected API

- Endpoint: `GET https://pixabay.com/images/search/<query>/?pagi=<pageNumber>` with headers:
  `Accept: application/json`, `x-fetch-bootstrap: 1`, `x-bootstrap-cache-miss: 1`
- Method: `GET`
- Auth: No account login required, but Cloudflare/session cookies from the browser session are required
- Pagination: `pagi=<pageNumber>` query parameter on the search URL
- Fields available:
  `id`, `mediaType`, `mediaSubType`, `mediaDescriptiveType`, `sources.1x`, `sources.2x`, `sources.downloadUrl`, `nsfw`, `isAiGenerated`, `width`, `height`, `uploadDate`, `href`, `alt`, `title`, `description`, `name`, `tagList`, `likeCount`, `commentCount`, `vector`, `isEditorsChoice`, `isLowQuality`, `qualityStatus`, `user.id`, `user.username`, `user.avatarSrc`, `user.profileUrl`, `user.donation.paypal`, `user.isActive`, `viewCount`, `downloadCount`, `canvaRetouchUrl`
- Fields currently missing in the previous actor:
  `mediaSubType`, `mediaDescriptiveType`, `href`, `alt`, `description`, `title`, `vector`, `isLowQuality`, `qualityStatus`, `user_id`, `user_avatarSrc`, `user_donation_paypal`, `user_isAvailableForHire`, `user_isActive`, `canvaRetouchUrl`
- Field count: 30+ useful fields vs roughly 18 in the previous output

## Discovery Notes

- Existing actor audit:
  The previous actor already depended on Pixabay's structured bootstrap data, but it still carried fallback parsing paths and only mapped a subset of fields.
- URLScan result:
  Public search found a historical Pixabay search-page scan (`aa9c64b9-a4e1-41fc-be7e-3580462ade8d`) for `https://pixabay.com/images/search/nature/`.
- URLScan limitation:
  The detailed result endpoint now returned `{"warning":"You're not logged in!"}` without authentication, so anonymous request replay was no longer available from URLScan alone.
- Direct page inspection:
  Plain HTTP fetches returned a Cloudflare interstitial, so browser inspection was required as the updater skill's last resort.
- Browser findings:
  The live page makes a second same-URL request with `Accept: application/json` and `x-fetch-bootstrap: 1`. That response contains the structured `page.results` payload with 100+ records on page 1 and a stable `pagi` pagination pattern.
- Weaker candidates rejected:
  - `/bootstrap/<hash>.json`: requested by the frontend, but currently returning `404` in the live browser session.
  - `window.__BOOTSTRAP__`: present in Chrome DevTools inspection, but not reliable in Patchright runtime and therefore not suitable as the primary extraction path.
  - `application/ld+json`: usable only as a reduced fallback with far fewer fields.
  - DOM parsing: unnecessary because the full structured payload is already available.
- HTTP-only viability:
  Not reliable at the moment because plain requests hit Cloudflare. The actor therefore keeps the browser for session establishment, then fetches the JSON payload directly inside that authenticated browser session instead of parsing DOM content.
