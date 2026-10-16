# SteadySignal landing page — design and content

## Central idea

A paid click is a handoff between an ad's promise and a landing page. Make that handoff the visual and editorial signature of SteadySignal. Speak to people running Meta campaigns who need to review destinations before launch and monitor them afterward.

## Hero — final copy

Eyebrow: **CAMPAIGN ASSURANCE FOR META ADS**

Headline: **Your ad makes a promise. Make sure the page keeps it.**

Supporting copy: Catch the disconnect between your Meta ads and their landing pages. Check before launch. Keep watch after.

Primary action: **Create your workspace** → `#/signup`

Secondary action: **See it in action** → product example

Supporting line: Read-only campaign checks. Optional campaign pausing.

## Visual direction

- Preserve the ivory, slate, coral, sage, and muted blue palette of the application.
- Use the same locally hosted Manrope and Inter fonts, with a larger editorial scale for the public page.
- Pair a generous, left-aligned headline with a bespoke product illustration: the ad's promise and its destination, connected through a SteadySignal finding.
- Let visitors switch the illustration between **Before launch** and **After launch**. Clearly label all sample data as an illustrative example.
- Use fine rules, numbered sections, small evidence labels, and a dark monitoring section. Keep the presentation calm and spacious.
- Navigation: Product, How it works, Questions, Log in, Get started. On phones, provide an accessible menu.
- Reuse the wave brand mark and the application's line icons.

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

Facts: Scheduled every minute. Current Meta destinations. Changes recorded as incidents.

Action: Explore campaign watch → after-launch example.

### 03 — Getting started

**A clearer view in three moves.**

1. **Connect Meta.** Choose the ad accounts you want in your workspace.
2. **Check a campaign.** Review its destinations and the findings that need your judgment.
3. **Keep watch.** Turn on monitoring for the campaigns you want to follow after launch.

### Questions

**Does SteadySignal change my ads?**

Campaign checks do not publish ads or edit creative. You can separately enable automatic pausing after repeated landing-page failures. That option requires Meta permission and two consecutive failed checks.

**How often are destinations checked?**

Active campaign watches are scheduled every minute. Each run refreshes the campaign's current destinations from Meta before inspecting them.

**What if a detail cannot be verified?**

It is marked “Could not confirm.” Some content comparisons use an optional AI service. Findings include source details so you can make the final call.

**Does it test the whole checkout?**

SteadySignal inspects the HTML served by the destination page. It does not complete purchases or validate the checkout flow. Dynamic or ambiguous details may need your review.

### Closing action

**Give your next click a better landing.**

Bring your campaigns and landing pages into the same view.

Action: Create your workspace → `#/signup`

Secondary link: Already have an account? Log in → `#/login`

## Content guardrails

Product claims were checked against the current application and backend documentation. Do not invent customer logos, testimonials, usage counts, revenue savings, pricing, free-trial terms, or instant-detection guarantees. Distinguish manual QA from scheduled monitoring, and optional pausing from read-only checks.

## Routing and acceptance

- `/` is a public landing page that renders without contacting the backend.
- `#/login` and `#/signup` open the existing authentication screens in the correct mode.
- Existing protected workspace and report links continue to work.
- Preserve authentication callbacks, password-manager support, and existing sessions.
- Verify navigation, example tabs, FAQ, authentication links, keyboard access, reduced motion, and mobile layouts.

## Composition references

[Plain](https://www.plain.com/) and [incident.io](https://incident.io/) informed the use of a clear product story and product-focused examples. The headline, copy, illustrations, and page composition are original to SteadySignal.
