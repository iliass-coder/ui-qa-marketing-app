import React, { useRef, useState } from "react";
import { Brand, BrandIcon } from "./Brand.jsx";
import { Icon } from "./icons.jsx";
import { PricingCards, AgencyNote } from "./Billing.jsx";
import { SupportLink } from "./support.jsx";
import { MetaAccessNotice, META_ACCESS_SUMMARY } from "./MetaAccessNotice.jsx";
import "./landing.css";

const questions = [
  ["Do scheduled inspections use analysis credits?", "No. Scheduled landing-page inspections are included in your monitored-page allowance and do not consume ad-analysis credits. A fresh campaign QA check uses one analysis per ad checked, including when several ads share a destination."],
  ["What counts as one monitored landing page?", "One distinct destination URL uses one page slot. A URL shared across campaigns counts once across your workspace. Different query strings, including different tracking tags, count as separate pages. URL fragments do not create another page."],
  ["What Meta access do I grant?", META_ACCESS_SUMMARY],
  ["Can I check a campaign before it goes live?", "Yes. Publish your campaign, ad sets, and ads in Meta Ads Manager with the campaign set to Paused, then sync in Click Cohere and run a check. Drafts and unpublished edits cannot be checked. Campaigns that are already live can be checked too."],
  ["Do I need to sync after making changes in Meta?", "Yes. After publishing a new campaign or changing your ads, budget, targeting, or landing-page links in Meta Ads Manager, click Sync campaigns in Click Cohere. Wait for the sync to finish, then run a new check. Without syncing, a new check can still use older campaign data."],
  ["How long does a campaign check take?", "Allow a few seconds for the check to complete. Larger campaigns or slower landing pages can take longer. You can keep working while it runs; we'll let you know in the app when your report is ready."],
  ["Does Click Cohere change my ads?", "Campaign checks do not publish ads or edit creative. Optional automatic pausing is in beta and requires you to accept a warning before enabling it. It can pause monitored campaigns after two confirmed page failures and a fresh recheck, with campaign management permission. Blocked or uncertain checks do not qualify. Paused campaigns must be restarted manually in Meta Ads."],
  ["How often are destinations checked?", "Paid campaign watches are scheduled every 30 minutes; the free monitoring trial runs every hour. Each run refreshes the campaign's current destinations from Meta before inspecting them."],
  ["Do I need a credit card for the trial?", "No. Your free preview includes 10 ad analyses in total and 14 days of monitoring for up to 3 landing pages. The monitoring trial starts with your first watch. When it ends, monitoring stops and your saved reports remain available. There is no automatic charge."],
  ["What if a detail cannot be verified?", "It is marked ‘Could not confirm.’ Some content comparisons use an optional AI service. Findings include source details so you can make the final call."],
];

// Public commentary about the problem, not customer testimonials or endorsements.
// Exact excerpts and original sources are recorded in docs/landing-page-brief.md.
const voices = [
  {
    topic: "The brand disconnect",
    quote: "One of the biggest culprits of brand inconsistency resides in product descriptions and feature pages.",
    name: "Michelle Polizzi",
    context: "Writing on HubSpot",
    source: "https://blog.hubspot.com/marketing/brand-inconsistency-sources",
    sourceName: "HubSpot article",
    mark: "MP",
  },
  {
    topic: "The missing promise",
    quote: "Sometimes companies go so far as sending clickers to a landing page without information that was implied or promised.",
    name: "Alex Birkett",
    context: "Writing on CXL",
    source: "https://cxl.com/blog/high-user-engagement/",
    sourceName: "CXL article",
    mark: "AB",
  },
  {
    topic: "The bigger picture",
    quote: "Start thinking about how landing pages could allow you to have multiple, simultaneous campaigns and still keep the messages aligned from ad to page.",
    name: "Oli Gardner",
    context: "Unbounce co-founder, on MarketingProfs",
    source: "https://www.marketingprofs.com/articles/2011/4512/clicking-me-softly-a-five-day-crash-course-in-conversion-day-4",
    sourceName: "MarketingProfs article",
    mark: "OG",
  },
];

function ProductExample({ phase, onPhaseChange, videoRef }) {
  const tabs = useRef([]);
  const after = phase === "after";
  const handleKey = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? 1 : after ? 0 : 1;
    onPhaseChange(index ? "after" : "before", true);
    tabs.current[index]?.focus();
  };
  const jumpTo = (seconds) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    video.focus();
    video.play().catch(() => { /* Native controls remain available if playback is blocked. */ });
  };

  return <div className="lp-example-wrap lp-walkthrough-wrap" id="product-example">
    <div className="lp-example-note"><span className="lp-note-rule" /> SEE THE ACTUAL PRODUCT</div>
    <div className="lp-example lp-walkthrough">
      <div className="lp-example-top"><span className="lp-mini-brand"><BrandIcon size={21} /> Campaign check → campaign watch</span><span className="lp-example-label">RECORDED WALKTHROUGH</span></div>
      <div className="lp-demo-tabs" role="tablist" aria-label="Walkthrough chapters">
        {[["before", "Before launch"], ["after", "After launch"]].map(([value, label], index) => <button type="button" key={value} ref={(element) => { tabs.current[index] = element; }} id={`example-tab-${value}`} role="tab" aria-selected={phase === value} aria-controls="example-panel" tabIndex={phase === value ? 0 : -1} onClick={() => onPhaseChange(value, true)} onKeyDown={handleKey}><Icon name={index ? "watch" : "shield"} size={15} />{label}</button>)}
      </div>
      <div id="example-panel" role="tabpanel" aria-labelledby={`example-tab-${phase}`} className="lp-walkthrough-panel">
        <video ref={videoRef} id="campaign-walkthrough" className="lp-walkthrough-video" controls playsInline preload="none" poster="/media/campaign-check-poster.jpg" tabIndex="0" aria-label="Click Cohere recorded campaign check and campaign watch walkthrough" aria-describedby="walkthrough-description" onTimeUpdate={(event) => onPhaseChange(event.currentTarget.currentTime >= 27 ? "after" : "before")}>
          <source src="/media/Click-Cohere-demo-campaign-watch.mp4" type="video/mp4" />
          <track kind="captions" src="/media/campaign-watch.en.vtt" srcLang="en" label="English" />
          Your browser does not support this video. <a href="/media/Click-Cohere-demo-campaign-watch.mp4">Open the walkthrough</a> or read the transcript below.
        </video>
        <div className="lp-walkthrough-copy" id="walkthrough-description"><strong>{after ? "See a landing-page failure become an incident." : "Run a check. Open the finding. See the evidence."}</strong><p>A recorded campaign, its ad copy, its landing-page response, and the report that connects them.</p></div>
        <div className="lp-video-chapters" aria-label="Find the proof in the recording">
          <button type="button" onClick={() => jumpTo(14)}><span>00:14</span> Ad copy</button>
          <button type="button" onClick={() => jumpTo(8)}><span>00:08</span> Landing page</button>
          <button type="button" onClick={() => jumpTo(33)}><span>00:33</span> Finding &amp; evidence</button>
        </div>
      </div>
    </div>
    <p className="lp-example-caption">57 seconds · Actual product UI, shown for demonstration.<br />The recording shows paid-plan checks every 30 minutes. Free-preview checks run hourly.</p>
    <details className="lp-video-transcript"><summary>Read the walkthrough and evidence</summary><div>
      <p><strong>The campaign and its ad.</strong> The recording checks the published, paused “Revetement” campaign. Its report quotes the ad text “surface cntre l’eau” and suggests the spelling correction “surface contre l’eau”.</p>
      <p><strong>The destination and finding.</strong> The landing-page check reports HTTP 404, content check FAIL, 2,464 captured characters, and HTTP_ERROR. The report includes a “View captured page evidence” entry. Campaign watch later shows the page failure as an incident.</p>
      <p><strong>Transcript.</strong> Open Campaigns to see the Meta campaigns you’ve synced. Pick the one you want to review and click Run check. The report shows what passed and what needs attention. It checks whether the landing page loads, how quickly the server responds, and whether the ad copy has spelling or grammar issues. Here, it suggests a correction for a French typo. That’s just a sample. You’ll find many more checks in the full report.</p>
      <p>Click Start watch to keep checking the campaign’s destination. Campaign Watch checks your landing pages every 30 minutes to see if they’re still up. Here, a page returned a 404, so it shows up as an incident. In Settings, you can turn on email alerts for new incidents. You can also enable automatic pausing for active campaigns on watch after repeated, confirmed page failures. Start your free preview at clickcohere.com.</p>
      <p><strong>Plan and permission details.</strong> The 30-minute schedule shown applies to paid plans; the free preview runs hourly. Automatic pausing is optional beta behavior, requires management permission, and applies only to qualifying confirmed page failures.</p>
    </div></details>
  </div>;
}
function IndustryVoices() {
  return <section className="lp-voices lp-container lp-section" id="voices" aria-labelledby="voices-title">
    <div className="lp-voices-heading"><div><div className="lp-eyebrow"><span className="lp-coral-dot" /> SOUND FAMILIAR?</div><h2 id="voices-title">Different teams.<br /><span className="lp-coral-text">The same disconnect.</span></h2></div><p>Brand consistency gets harder after the handoff. Here’s how people in marketing describe it.</p></div>
    <div className="lp-quote-grid">{voices.map((voice) => <figure className="lp-quote" key={voice.name}>
      <div className="lp-quote-topic"><span aria-hidden="true">“</span>{voice.topic}</div>
      <blockquote cite={voice.source}>{voice.quote}</blockquote>
      <figcaption><span className="lp-voice-mark" aria-hidden="true">{voice.mark}</span><div><strong>{voice.name}</strong><span>{voice.context}</span></div></figcaption>
      <a href={voice.source} target="_blank" rel="noopener noreferrer" aria-label={`Read the original ${voice.sourceName}`}>Read the original <Icon name="arrow" size={14} /></a>
    </figure>)}</div>
    <p className="lp-voices-note">Public commentary on the problem. These are not Click Cohere customer reviews or endorsements.</p>
  </section>;
}

export function LandingPage({ year = new Date().getFullYear() } = {}) {
  const [phase, setPhase] = useState("before");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const videoRef = useRef(null);
  const closeMenu = () => setMenuOpen(false);
  const setDemoPhase = (value, seek = false) => {
    setPhase(value);
    if (seek && videoRef.current) videoRef.current.currentTime = value === "after" ? 27 : 0;
  };
  const watchCampaignCheck = () => {
    setDemoPhase("before", true);
    videoRef.current?.focus();
    videoRef.current?.play().catch(() => { /* Visitors can also use native playback controls. */ });
  };

  return <div className="landing-page">
    <a className="lp-skip" href="#landing-content">Skip to content</a>
    <header className="lp-header" onKeyDown={(event) => { if (event.key === "Escape" && menuOpen) { closeMenu(); menuButton.current?.focus(); } }}>
      <div className="lp-nav-shell">
        <a href="/" className="lp-brand-link" aria-label="Click Cohere home"><Brand /></a>
        <nav id="landing-navigation" className={`lp-navigation ${menuOpen ? "is-open" : ""}`} aria-label="Website navigation">
          <a href="#product" onClick={closeMenu}>What it catches</a><a href="#how-it-works" onClick={closeMenu}>How it works</a><a href="#pricing" onClick={closeMenu}>Pricing</a><a href="#questions" onClick={closeMenu}>Questions</a>
          <div className="lp-mobile-auth"><a href="#/login">Log in <Icon name="arrow" size={16} /></a><a href="#/signup">Start your free preview <Icon name="arrow" size={16} /></a></div>
        </nav>
        <div className="lp-nav-actions"><a href="#/login" className="lp-login-link">Log in</a><a href="#/signup" className="lp-button lp-button-small">Start free <Icon name="arrow" size={15} /></a><button type="button" ref={menuButton} className="lp-menu-button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={23} /></button></div>
      </div>
    </header>

    <main id="landing-content" tabIndex="-1">
      <section className="lp-hero lp-container" aria-labelledby="landing-headline">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow"><span className="lp-coral-dot" /> CAMPAIGN CHECKS &amp; MONITORING FOR META ADS</div>
          <h1 id="landing-headline">Your ad makes <br />a promise.<span>Make sure the<br />page keeps it.</span></h1>
          <p className="lp-hero-description">Catch broken destinations and conflicting offers in your Meta ads. Check campaigns before activation and monitor their landing pages after launch.</p>
          <div className="lp-hero-actions"><a href="#/signup" className="lp-button">Start your free preview <Icon name="arrow" size={17} /></a><a href="#product-example" className="lp-text-link" onClick={watchCampaignCheck}>Watch a campaign check <span className="lp-play-icon" aria-hidden="true">▶</span></a></div>
          <p className="lp-hero-assurance"><Icon name="shield" size={14} /><span><strong>10</strong> ad analyses. <strong>14</strong> days of monitoring. No card.</span></p>
        </div>
        <ProductExample phase={phase} onPhaseChange={setDemoPhase} videoRef={videoRef} />
      </section>

      <div className="lp-checkpoint-strip lp-container" role="group" aria-label="Campaign coverage"><div><span>01 / BEFORE LAUNCH</span><p>Check the promise.</p></div><BrandIcon size={25} /><div><span>02 / AFTER LAUNCH</span><p>Watch for the change.</p></div><BrandIcon size={25} /><div><span>03 / ALWAYS YOUR CALL</span><p>Follow the evidence.</p></div></div>

      <IndustryVoices />

      <section className="lp-product-section lp-container lp-section" id="product" aria-labelledby="product-title">
        <div className="lp-section-intro"><div className="lp-section-index">01 <span>THE PART AFTER THE CLICK</span></div><h2 id="product-title">Small details.<br />Real reasons<br />to leave<span className="lp-coral-text">.</span></h2><p>Your customer doesn’t see the handoffs, the edits, or the launch checklist. They see a promise. And whether your page keeps it.</p><div className="lp-handoff-signature" aria-hidden="true"><span>YOUR AD</span><span className="lp-signature-rule"><BrandIcon size={27} /></span><span>YOUR PAGE</span></div></div>
        <div className="lp-feature-list">
          <article><span className="lp-feature-icon"><Icon name="link" size={22} /></span><div><h3>The link that leads nowhere.</h3><p>The creative is approved. The URL isn’t right. Surface broken links, unreachable pages, and unexpected destination changes.</p><span className="lp-feature-detail">Destination &amp; availability checks</span></div></article>
          <article><span className="lp-feature-icon"><Icon name="campaigns" size={22} /></span><div><h3>The offer that tells two stories.</h3><p>Free delivery in the ad. Different terms on the page. Review product details, promotions, and delivery claims together.</p><span className="lp-feature-detail">Ad &amp; landing-page comparisons</span></div></article>
          <article><span className="lp-feature-icon"><Icon name="shield" size={22} /></span><div><h3>The evidence behind the warning.</h3><p>See what was expected, what was found, and where it came from. Make the fix with context instead of guesswork.</p><span className="lp-feature-detail">Source details for your review</span></div></article>
        </div>
      </section>

      <section className="lp-monitoring" aria-labelledby="monitoring-title"><div className="lp-container lp-monitoring-grid">
        <div className="lp-monitoring-copy"><div className="lp-section-index">02 <span>BECAUSE PAGES CHANGE</span></div><h2 id="monitoring-title">You hit launch.<br /><span>The page can<br />still change.</span></h2><p>A price edit. A missing claim. A page that goes down. Campaign watch checks your current Meta destinations on a schedule, so you have a record of what changed.</p><ul><li><Icon name="check" size={16} /> Prices, stock wording, and watched claims</li><li><Icon name="check" size={16} /> Page failures and destination changes</li><li><Icon name="check" size={16} /> Recorded evidence to review</li></ul><a href="#product-example" className="lp-light-link" onClick={() => setDemoPhase("after", true)}>See the after-launch example <Icon name="arrow" size={18} /></a></div>
        <div className="lp-watch-illustration">
          <div className="lp-watch-cadence"><span>30<span>min</span></span><p>BETWEEN SCHEDULED CHECKS ON PAID PLANS</p><small>Free preview: every hour</small></div>
          <div className="lp-watch-card"><div className="lp-watch-card-top"><span><Icon name="watch" size={16} /> Campaign watch</span><span className="lp-watch-tag">EXAMPLE</span></div><div className="lp-watch-row"><span className="lp-watch-node is-baseline"><Icon name="check" size={13} /></span><div><span>BASELINE PRICE</span><strong>$89.00 <small>USD</small></strong></div><span className="lp-watch-row-note">Reference saved</span></div><div className="lp-watch-row"><span className="lp-watch-node is-current"><Icon name="globe" size={13} /></span><div><span>LATEST INSPECTION</span><strong>$99.00 <small>USD</small></strong></div><span className="lp-watch-row-note">Change found</span></div><div className="lp-watch-result"><Icon name="warning" size={18} /><span>Price changed. Evidence recorded.</span></div></div>
          <p className="lp-watch-caption">The ad stays live. You get a change to review.<br />Automatic pausing is optional and only applies to confirmed page failures.</p>
        </div>
      </div></section>

      <section className="lp-workflow lp-container lp-section" id="how-it-works" aria-labelledby="workflow-title"><div className="lp-workflow-heading"><div><div className="lp-section-index">03 <span>YOUR NEXT PRE-LAUNCH RITUAL</span></div><h2 id="workflow-title">From connected<br />to checked. In 3 steps.</h2></div><a href="#/signup" className="lp-text-link">Try your first campaign <Icon name="arrow" size={18} /></a></div><div className="lp-steps">{[
        ["01", "meta", "Connect Meta.", "Choose the ad accounts you want to check. Your creative stays in Meta."],
        ["02", "shield", "Sync. Check. Review.", "Sync a published campaign, including paused campaigns. Run a check and review the findings."],
        ["03", "watch", "Keep an eye on it.", "Enable campaign watch to inspect its destinations on a schedule after launch."],
      ].map(([number, icon, title, copy]) => <article key={number}><div className="lp-step-top"><span>{number}</span><Icon name={icon} size={25} /></div><h3>{title}</h3><p>{copy}</p>{number === "01" && <MetaAccessNotice compact />}</article>)}</div></section>

      <section className="lp-pricing lp-container lp-section" id="pricing" aria-labelledby="pricing-title"><div className="lp-pricing-header"><div><div className="lp-section-index">04 <span>CHECK FIRST. CHOOSE WHEN YOU’RE READY.</span></div><h2 id="pricing-title">Start free.<br />Grow your coverage.</h2></div><p>10 ad analyses. 14 days of monitoring for 3 pages. See what you catch before choosing a monthly plan.</p></div><PricingCards publicPage /><AgencyNote /><div className="lp-pricing-footnote"><p><strong>No credit card. No automatic charge.</strong> Your 14-day monitoring preview starts with your first watch. Trial inspections run every hour. Saved reports stay available when the trial ends.</p><p><strong>One ad. One analysis.</strong> A fresh campaign check uses one analysis for each ad checked, even when ads share a destination. Scheduled landing-page inspections do not consume analysis credits; they are included in your monitored-page allowance.</p><p><strong>One distinct URL. One monitored page.</strong> A destination shared across campaigns counts once across your workspace. Different query strings, including tracking-tag variants, count as separate pages. URL fragments do not add another page.</p><p><strong>Monthly allowances renew each billing period.</strong> Paid subscribers can add 100 analyses for $15, valid for 90 days. Prices are in USD; applicable tax is shown at checkout.</p></div></section>

      <section className="lp-faq lp-container lp-section" id="questions" aria-labelledby="questions-title"><div className="lp-section-intro"><div className="lp-section-index">05 <span>THE DETAILS, WITHOUT THE SMALL PRINT</span></div><h2 id="questions-title">A few things<br />worth checking.</h2></div><div className="lp-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true"><Icon name="close" size={14} /></span></summary><p>{answer}</p></details>)}</div></section>

      <section className="lp-final-cta lp-container" aria-labelledby="final-cta-title"><div className="lp-cta-mark" aria-hidden="true"><BrandIcon size={34} /></div><div className="lp-eyebrow">FOR THE PERSON WHO CHECKS EVERYTHING</div><h2 id="final-cta-title">One less “how<br /><span>did we miss that?”</span></h2><p>Give your next campaign a second pair of eyes.</p><a href="#/signup" className="lp-button">Check my first campaign <Icon name="arrow" size={17} /></a><p className="lp-final-trial">10 ad analyses · 14-day monitoring preview · No credit card</p><p className="lp-final-login">Already have an account? <a href="#/login">Log in <Icon name="arrow" size={13} /></a></p></section>
    </main>

    <footer className="lp-footer lp-container"><div className="lp-footer-top"><a href="/" className="lp-brand-link" aria-label="Click Cohere home"><Brand /></a><p>Keep the promise<br />behind the click.</p><nav aria-label="Footer navigation"><a href="#product">What it catches</a><a href="#voices">Why it matters</a><a href="#pricing">Pricing</a><a href="#questions">Questions</a></nav><nav aria-label="Account and support navigation"><a href="#/login">Log in</a><a href="#/signup">Start your free preview <Icon name="arrow" size={13} /></a><a href="/support.html">Contact support</a></nav></div><p className="lp-footer-contact">Email us at <SupportLink />.</p><nav className="lp-footer-policies" aria-label="Legal"><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="/refunds.html">Refunds &amp; cancellation</a></nav><div className="lp-footer-bottom"><span>© {year} Click Cohere</span><span>Every click, connected.</span><a href="#landing-content">Back to top ↑</a></div></footer>
  </div>;
}
