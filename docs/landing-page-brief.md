# Click Cohere public homepage: product proof and crawlability

Updated 2026-11-04. Implementation and verification are local. The production site requires a fresh deployment containing both frontend and backend changes.

## Hero and recording

Preserve the live headline: **Your ad makes a promise. Make sure the page keeps it.** The new subhead is **Catch broken destinations and conflicting offers in your Meta ads. Check campaigns before activation and monitor their landing pages after launch.**

The primary action is **Start your free preview** (`#/signup`). **Watch a campaign check** links to the existing `#product-example` section and starts the native player. Before/After Launch tabs seek to the corresponding part of the recording, with keyboard Left/Right/Home/End support. Additional chapter buttons jump to the ad copy, landing-page response, and incident evidence.

The supplied `Click-Cohere-demo-campaign-watch.mp4` is a 56.88-second, 1920 x 1080 H.264/AAC product walkthrough. The public copy is unchanged at `public/media/Click-Cohere-demo-campaign-watch.mp4`. The poster is a frame from the recording, not an invented screen. The video uses native controls, inline mobile playback, no autoplay on page load, and `preload="none"`. An English caption track and an expandable transcript/evidence summary accompany it.

The recording contains the published, paused Revetement campaign; ad-copy source text and its suggested spelling correction; a landing-page HTTP 404 with FAIL, HTTP_ERROR, and 2,464 captured characters; a captured-page-evidence entry; and the corresponding monitoring incident. The copy does not imply that the raw captured evidence panel is expanded in the recording. The visible cadence note makes clear that the recording's 30-minute schedule is for paid plans; free-preview checks run hourly.

## Verified billing units

The homepage note and FAQ now explain:

- A fresh campaign QA run consumes one analysis per ad checked, even if multiple ads share a URL.
- Scheduled landing-page inspections do not consume analysis credits. They use the plan's monitored-page allowance.
- A shared destination URL counts once across the workspace. Different query strings, including tracking-tag variants, count separately. Fragments do not add a page.

Implementation evidence: `billing/UsageService.java` reserves by `(run_id, ad_id)` and defines URL identity in `pageKey`, `campaignPages`, and `desired`. `service/QaService.java` makes the analysis reservations/completions. `jobs/MonitoringScheduler.java` and `service/MonitoringService.java` enforce page capacity without reserving ad analyses. Existing BillingIntegrationTest coverage checks shared pages and query variants.

Existing prices, quotas, 14-day trial start rules, and no-card terms remain driven by `src/plans.js` and the backend plan catalog. The free preview includes 10 ad analyses and 14 days of hourly inspections for up to 3 pages. Paid inspections are scheduled every 30 minutes; this is not a guaranteed detection deadline.

## Verified Meta access

The shared `MetaAccessNotice` appears next to Connect Meta on the homepage and before in-app connection/reconnection actions, including Settings and the access-expiry notice.

The actual flow in `meta/MetaMarketingClient.java` requests **ads_read and ads_management together**. Standard checks need read access; optional pausing needs management permission. `MetaSyncService.connect` requires a granted `ads_read` scope, while campaign pausing separately requires `ads_management`, opt-in, beta acceptance, and confirmation safeguards. The new copy explicitly states that management access is requested by the current authorization; it does not claim a separate later permission prompt.

Settings → Meta Ads → Disconnect removes the saved local connection through `DELETE /api/integrations/meta` and `MetaSyncService.disconnect`. It does not revoke Meta permissions remotely or restart paused campaigns. No OAuth scopes or campaign behavior were changed by this revision.

## Initial HTML and routing

`npm run build` runs Vite and then renders the same `LandingPage` component with React's server renderer into `dist/index.html`. This delivers the headline, concrete description, pricing, and complete FAQ answer text before JavaScript runs. Native FAQ controls also work with JavaScript disabled. Copy is not duplicated in a separate crawler-only template.

`main.jsx` hydrates the pre-rendered public home. Direct signup, recovery, plan-intent, and protected hash routes still render their existing screens. The rendered year is passed from the HTML into React so cached pages do not produce a footer hydration mismatch at a year boundary.

Use the production preview (`npm run preview -- --port 4173`) to inspect initial HTML. Vite development mode continues to use its development entry point.

## Crawl and deployment changes

Anonymous live checks on 2026-11-04 returned **401**, not 500, for both crawl files. The live homepage returned 200. The security allowlist omitted crawl resources; missing static resources also fell through to a generic internal-error handler.

- `public/robots.txt` allows public pages, excludes API/OAuth/documentation paths, and advertises the canonical sitemap.
- `public/sitemap.xml` contains the canonical homepage, support, privacy, terms, and refunds URLs. It excludes hash routes, private app pages, and the legacy Render hostname.
- Spring's exact public GET/HEAD allowlist now includes crawl files, the sharing image, and `/media/**`. Private API authentication remains unchanged.
- Missing public files return 404 through a specific NoResourceFoundException handler.
- `PublicAssetConfig` supplies explicit text/plain, application/xml, and text/vtt MIME mappings. The caption mapping was necessary on the local Spring/Tomcat server.
- `deployment/Dockerfile` and `Prepare-Release.ps1` include the frontend `scripts/` directory so the production build can run the pre-render step. Frontend `dist/` is still copied into Spring static resources by the existing Docker build.

A source release must include both projects and the updated Dockerfile. The existing release-preparation script includes all current working changes, so inspect unrelated work before publishing a release. No production deployment or private account operation was performed during these checks.

## Validation and production follow-up

Local checks cover the production frontend build; the 30 existing frontend tests; billing and Meta token regressions; actual anonymous HTTP responses through Spring; crawl-file GET/HEAD, body validity and MIME types; all sitemap targets; a video byte-range request; caption/poster/sharing assets; 404 behavior; protected API 401 behavior; desktop/mobile hero actions and signup; keyboard chapters; native FAQ interactions; and initial HTML with JavaScript disabled.

Results: 30 frontend tests, 20 billing tests, 9 Meta token tests, and 5 real-HTTP website tests passed. Responsive checks passed at 320, 390, 768, 1024, and 1440 CSS pixels. The Settings disclosure was also verified before its authorization button on a mobile fixture with no real account or OAuth changes. The production video returned HTTP 206 for byte-range requests through the local Spring server. Crawl GET/HEAD returned 200 with text/plain and application/xml, and captions returned text/vtt. The separate frontend-only preview has no running API, so its optional analytics-config proxy request returns 500; that is not the crawl-file test result.

The backend HTTP contract suite uses the actual built frontend rather than copied fixtures. Run it with JDK 21, after the frontend build:

```powershell
mvn.cmd -B -ntp '-Dtest=PublicWebsiteTest' '-Dwebsite.static-location=file:///C:/path/to/ui-qa-marketing-app/dist/' test
```

It uses the isolated test profile/H2 database and disables email. It is opt-in so the independent backend repository does not require a frontend checkout for its usual test command.

After deployment, verify on `https://www.clickcohere.com/`: raw initial HTML, crawl-file GET/HEAD 200 and content types, canonical sitemap targets, video playback/seeking and captions, both hero actions, direct signup and plan-intent routes, and FAQ interactions on desktop/mobile. Refresh cached crawler responses as needed. Complete a real Meta consent/reconnect/disconnect check only with a designated test account; no real permission grant or campaign action was exercised locally.

## Existing design and industry voices

Retain ivory, slate, coral, sage, muted blue, and local Manrope/Inter fonts. Industry commentary remains clearly distinguished from customer reviews or endorsements, with original-source links for Michelle Polizzi (HubSpot), Alex Birkett (CXL), and Oli Gardner (MarketingProfs). No invented customer claims, savings, or conversion lift is added. The code-native social thumbnail and its editable source remain available in `public/og-image.png` and `scripts/og-card.html`.
