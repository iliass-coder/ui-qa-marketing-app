# Click Cohere landing page — design and content

## Central idea

A paid click is a handoff between an ad's promise and a landing page. Make that handoff the visual and editorial signature of Click Cohere. Speak to people running Meta campaigns who need to review destinations before launch and monitor them afterward.

## Hero — final copy

Eyebrow: **CAMPAIGN ASSURANCE FOR META ADS**

Headline: **Your ad makes a promise. Make sure the page keeps it.**

Supporting copy: Catch the disconnect between your Meta ads and their landing pages. Check before launch. Keep watch after.

Primary action: **Create your account** → `#/signup`

Secondary action: **See it in action** → product example

Supporting line: Read-only campaign checks. Optional campaign pausing.

## Visual direction

- Preserve the ivory, slate, coral, sage, and muted blue palette of the application.
- Use the same locally hosted Manrope and Inter fonts, with a larger editorial scale for the public page.
- Pair a generous, left-aligned headline with a bespoke product illustration: the ad's promise and its destination, connected through a Click Cohere finding.
- Let visitors switch the illustration between **Before launch** and **After launch**. Clearly label all sample data as an illustrative example.
- Use fine rules, numbered sections, small evidence labels, and a dark monitoring section. Keep the presentation calm and spacious.
- Navigation: Product, How it works, Questions, Log in, Get started. On phones, provide an accessible menu.
- Use the linked C brand mark and Click Cohere wordmark consistently, alongside the application's line icons.

## Page story and final section copy

### 01 — The handoff

**Every click is a handoff.**

The offer. The destination. The details that changed overnight. Give them a second look before someone else discovers the disconnect.

Feature headings and descriptions:

1. **A destination worth the click.** Surface broken links, unreachable pages, and unexpected destination changes.
2. **An offer that tells the same story.** Review the campaign and page together, including promotions, availability, and delivery details.
3. **Findings you can follow.** See what was expected, what was found, and the evidence behind the result.

### 02 — Monitoring

**Launch is a moment. Your page keeps moving.**

Start a campaign watch to keep checking its current destinations. Each scheduled run refreshes the campaign from Meta before inspecting the pages.

Facts: Paid inspections every 30 minutes; free preview inspections every hour. Current Meta destinations. Changes recorded as incidents.

Action: Explore campaign watch → after-launch example.

### 03 — Getting started

**A clearer view in three moves.**

1. **Connect Meta.** Choose the Meta ad accounts you want to connect.
2. **Check a campaign.** Review its destinations and the findings that need your judgment.
3. **Keep watch.** Turn on monitoring for the campaigns you want to follow after launch.

### Questions

**Can I check a campaign before it goes live?**

Yes. Publish your campaign, ad sets, and ads in Meta Ads Manager with the campaign set to Paused, then sync in Click Cohere and run a check. Drafts and unpublished edits cannot be checked. Campaigns that are already live can be checked too.

**Do I need to sync after making changes in Meta?**

Yes. After publishing a new campaign or changing your ads, budget, targeting, or landing-page links in Meta Ads Manager, click Sync campaigns in Click Cohere. Wait for the sync to finish, then run a new check. Without syncing, a new check can still use older campaign data.

**How long does a campaign check take?**

Allow a few seconds for the check to complete. Larger campaigns or slower landing pages can take longer. You can keep working while it runs; we'll let you know in the app when your report is ready.

**Does Click Cohere change my ads?**

Campaign checks do not publish ads or edit creative. Optional automatic pausing is in beta and requires you to accept a warning before enabling it. It can pause monitored campaigns after two confirmed page failures and a fresh recheck, with campaign management permission. Blocked or uncertain checks do not qualify. Paused campaigns must be restarted manually in Meta Ads.

**How often are destinations checked?**

Paid campaign watches are scheduled every 30 minutes; the free monitoring trial runs every hour. Each run refreshes the campaign’s current destinations from Meta before inspecting them.

**Do I need a credit card for the trial?**

No. Your free preview includes 10 ad analyses in total and 14 days of monitoring for up to 3 landing pages. The monitoring trial starts with your first watch. When it ends, monitoring stops and your saved reports remain available. There is no automatic charge.

**What if a detail cannot be verified?**

It is marked “Could not confirm.” Some content comparisons use an optional AI service. Findings include source details so you can make the final call.

### Closing action

**Give your next click a better landing.**

Bring your campaigns and landing pages into the same view.

Action: Create your account → `#/signup`

Secondary link: Already have an account? Log in → `#/login`

## Content guardrails

Product claims were checked against the current application and backend documentation. Do not invent customer logos, testimonials, usage counts, revenue savings, pricing, free-trial terms, or instant-detection guarantees. Distinguish manual QA from scheduled monitoring, and optional pausing from read-only checks.

## Routing and acceptance

- `/` is a public landing page that renders without contacting the backend.
- `#/login` and `#/signup` open the existing authentication screens in the correct mode.
- Existing protected account and report links continue to work.
- Preserve authentication callbacks, password-manager support, and existing sessions.
- Verify navigation, example tabs, FAQ, authentication links, keyboard access, reduced motion, and mobile layouts.

## Composition references

[Plain](https://www.plain.com/) and [incident.io](https://incident.io/) informed the use of a clear product story and product-focused examples. The headline, copy, illustrations, and page composition are original to Click Cohere.

## Pricing update

The public page now includes Free Preview (10 analyses total and 14 days of monitoring for 3 pages, without a credit card), Starter ($39/month, 100 analyses, 5 pages, 1 Meta account), and Growth ($99/month, 500 analyses, 25 pages, 3 accounts). Agency is available by arrangement from $249/month. Analysis packs cost $15 for 100, valid for 90 days. The pricing section follows the existing ivory, coral, and sage palette, with Growth in a dark feature card. All public terms mirror backend entitlements documented in `qa-marketing-integration/docs/billing.md`.
