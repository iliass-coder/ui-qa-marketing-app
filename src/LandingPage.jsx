import React, { useRef, useState } from "react";
import { Brand } from "./Brand.jsx";
import { Icon } from "./icons.jsx";
import "./landing.css";
import { PricingCards, AgencyNote } from "./Billing.jsx";

const questions = [
  ["Does SteadySignal change my ads?", "Campaign checks do not publish ads or edit creative. You can separately enable automatic pausing after repeated landing-page failures. That option requires Meta permission and two consecutive failed checks."],
  ["How often are destinations checked?", "Paid campaign watches are scheduled every 15 minutes; the free monitoring trial runs every 30 minutes. Each run refreshes the campaign’s current destinations from Meta before inspecting them."],
  ["Do I need a credit card for the trial?", "No. Your free preview includes 10 ad analyses in total and 14 days of monitoring for up to 3 landing pages. The monitoring trial starts with your first watch. When it ends, monitoring stops and your saved reports remain available. There is no automatic charge."],
  ["What counts as an analysis or a monitored page?", "One analysis checks one ad against its landing page, including all supported checks. A campaign with 20 ads uses 20 analyses. One distinct landing-page URL uses one monitoring slot across your workspace, even when several campaigns share it. Meaningful query variants count separately."],
  ["What happens when I reach my limits?", "Existing watches continue when you use your analysis allowance. Paid subscribers can add 100 analyses for $15, valid for 90 days. New watches must fit your page allowance. If Meta adds destinations beyond your coverage, your existing allocated pages stay covered and extra pages wait for space or an upgrade."],
  ["What if a detail cannot be verified?", "It is marked “Could not confirm.” Some content comparisons use an optional AI service. Findings include source details so you can make the final call."],
  ["Does it test the whole checkout?", "SteadySignal inspects the HTML served by the destination page. It does not complete purchases or validate the checkout flow. Dynamic or ambiguous details may need your review."],
];

function ProductArtwork({ muted = false }) {
  return <svg viewBox="0 0 220 130" fill="none" aria-hidden="true" className="lp-product-art">
    <rect width="220" height="130" fill={muted ? "#ebe9df" : "#e6e9df"} />
    <path d="M74 130V63a38 38 0 0 1 76 0v67" fill="#56717b" />
    <path d="M86 130V64a26 26 0 0 1 52 0v66" fill="#c7cfc1" />
    <circle cx="164" cy="36" r="21" fill="#ce654d" />
    <path d="M26 109h168M36 97h23M168 97h17" stroke="#26383e" strokeOpacity=".25" />
    <path d="M103 130V82a9 9 0 0 1 18 0v48" fill="#f5f2ea" />
    <path d="M31 45h24M43 33v24" stroke="#4d795f" strokeOpacity=".5" strokeWidth="1.5" />
  </svg>;
}

function ProductExample({ phase, onPhaseChange }) {
  const tabs = useRef([]);
  const after = phase === "after";
  const handleKey = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === "Home" ? 0 : event.key === "End" ? 1 : after ? 0 : 1;
    onPhaseChange(index ? "after" : "before");
    tabs.current[index]?.focus();
  };

  return <div className="lp-example-wrap" id="product-example">
    <div className="lp-example-note"><span className="lp-note-line" /> ONE CLICK. TWO SIDES OF THE STORY.</div>
    <div className="lp-example">
      <div className="lp-example-top"><span className="lp-mini-brand"><Icon name="watch" size={18} /> steady signal</span><span className="lp-example-label">PRODUCT EXAMPLE</span></div>
      <div className="lp-demo-tabs" role="tablist" aria-label="Explore SteadySignal">
        {[["before", "Before launch"], ["after", "After launch"]].map(([value, label], index) => <button key={value} ref={(element) => { tabs.current[index] = element; }} id={`example-tab-${value}`} role="tab" aria-selected={phase === value} aria-controls="example-panel" tabIndex={phase === value ? 0 : -1} onClick={() => onPhaseChange(value)} onKeyDown={handleKey}>{label}<span>{index ? "02" : "01"}</span></button>)}
      </div>
      <div id="example-panel" role="tabpanel" aria-labelledby={`example-tab-${phase}`} tabIndex="0" className="lp-demo-panel">
        <div className="lp-compare">
          <div className="lp-compare-card lp-ad-card"><div className="lp-compare-label"><Icon name="campaigns" size={13} /> THE AD</div><ProductArtwork /><div className="lp-compare-copy"><span>THE WEEKEND COLLECTION</span><strong>20% off.</strong><small>A little something for your space.</small></div></div>
          <span className="lp-handoff" aria-hidden="true"><Icon name="arrow" size={17} /></span>
          <div className={`lp-compare-card lp-destination-card ${after ? "is-unavailable" : ""}`}><div className="lp-compare-label"><Icon name="globe" size={13} /> THE LANDING PAGE</div>{after ? <div className="lp-404"><span>404</span><Icon name="link" size={29} /><strong>This page is missing.</strong><small>The ad still points here.</small></div> : <><ProductArtwork muted /><div className="lp-compare-copy"><span>THE WEEKEND COLLECTION</span><strong>10% off.</strong><small>Same collection. A different offer.</small></div></>}</div>
        </div>
        <div className="lp-demo-finding" aria-live="polite"><span className="lp-finding-mark"><Icon name="warning" size={19} /></span><div><strong>{after ? "Destination unavailable" : "The offer doesn’t match"}</strong><p>{after ? "The latest inspection returned HTTP 404." : "Your ad says 20% off. The page says 10%."}</p></div><span className="lp-review-tag">{after ? "Incident" : "Review"}</span></div>
        <div className="lp-demo-evidence"><Icon name="shield" size={13} /><span>{after ? "Keep the change. Keep the evidence." : "See the difference before your customers do."}</span></div>
      </div>
    </div>
    <div className="lp-example-caption"><span><span className="lp-tiny-dot" /> Illustrative example</span><span>Campaign → page → clarity</span></div>
  </div>;
}

export function LandingPage() {
  const [phase, setPhase] = useState("before");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const closeMenu = () => setMenuOpen(false);
  const showMonitoring = () => setPhase("after");

  return <div className="landing-page">
    <a className="lp-skip" href="#landing-content">Skip to content</a>
    <header className="lp-header" onKeyDown={(event) => { if (event.key === "Escape" && menuOpen) { setMenuOpen(false); menuButton.current?.focus(); } }}>
      <div className="lp-nav-shell">
        <a href="/" className="lp-brand-link" aria-label="SteadySignal home"><Brand /></a>
        <nav id="landing-navigation" className={`lp-navigation ${menuOpen ? "is-open" : ""}`} aria-label="Website navigation">
          <a href="#product" onClick={closeMenu}>The product</a><a href="#how-it-works" onClick={closeMenu}>How it works</a><a href="#pricing" onClick={closeMenu}>Pricing</a><a href="#questions" onClick={closeMenu}>Questions</a>
          <div className="lp-mobile-auth"><a href="#/login">Log in <Icon name="arrow" size={16} /></a><a href="#/signup">Create your workspace <Icon name="arrow" size={16} /></a></div>
        </nav>
        <div className="lp-nav-actions"><a href="#/login" className="lp-login-link">Log in</a><a href="#/signup" className="lp-button lp-button-small">Get started <Icon name="arrow" size={15} /></a><button ref={menuButton} className="lp-menu-button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} size={23} /></button></div>
      </div>
    </header>

    <main id="landing-content" tabIndex="-1">
      <section className="lp-hero lp-container" aria-labelledby="landing-headline">
        <div className="lp-hero-copy"><div className="lp-eyebrow"><span className="lp-coral-dot" /> CAMPAIGN ASSURANCE FOR META ADS</div><h1 id="landing-headline">Your ad makes <br />a promise. <span>Make sure the <br />page keeps it.</span></h1><p className="lp-hero-description">Catch the disconnect between your Meta ads and their landing pages. Check before launch. Keep watch after.</p><div className="lp-hero-actions"><a href="#/signup" className="lp-button">Start your free preview <Icon name="arrow" size={17} /></a><a href="#product-example" className="lp-secondary-link">See it in action <span className="lp-play-mark"><Icon name="chevron" size={12} /></span></a></div><p className="lp-hero-assurance"><Icon name="shield" size={14} /> 10 ad analyses. 14-day monitoring preview. No credit card.</p></div>
        <ProductExample phase={phase} onPhaseChange={setPhase} />
      </section>

      <div className="lp-principles lp-container"><div className="lp-principle-intro">A CLEARER SIGNAL. <br /><strong>ON BOTH SIDES OF THE CLICK.</strong></div><div><Icon name="meta" size={23} /><span>Connected to your <br /><strong>Meta campaigns</strong></span></div><div><Icon name="shield" size={23} /><span>Findings with <br /><strong>evidence attached</strong></span></div><div><Icon name="watch" size={23} /><span>Before launch. <br /><strong>And what comes after.</strong></span></div></div>

      <section className="lp-product-section lp-container lp-section" id="product" aria-labelledby="product-title">
        <div className="lp-section-intro"><div className="lp-section-index">01 <span>THE HANDOFF</span></div><h2 id="product-title">Every click <br />is a handoff<span className="lp-coral-text">.</span></h2><p>The offer. The destination. The details that changed overnight. Give them a second look before someone else discovers the disconnect.</p><div className="lp-handoff-signature" aria-hidden="true"><span>YOUR AD</span><span className="lp-signature-rule"><Icon name="watch" size={25} /></span><span>YOUR PAGE</span></div></div>
        <div className="lp-feature-list">
          <article><span className="lp-feature-icon"><Icon name="link" size={22} /></span><div><h3>A destination worth the click.</h3><p>Surface broken links, unreachable pages, and unexpected destination changes.</p><span className="lp-feature-detail">Destination & availability checks</span></div></article>
          <article><span className="lp-feature-icon"><Icon name="campaigns" size={22} /></span><div><h3>An offer that tells the same story.</h3><p>Review the campaign and page together, including promotions, availability, and delivery details.</p><span className="lp-feature-detail">Campaign & page comparisons</span></div></article>
          <article><span className="lp-feature-icon"><Icon name="shield" size={22} /></span><div><h3>Findings you can follow.</h3><p>See what was expected, what was found, and the evidence behind the result.</p><span className="lp-feature-detail">A clear trail from finding to source</span></div></article>
        </div>
      </section>

      <section className="lp-monitoring" aria-labelledby="monitoring-title"><div className="lp-container lp-monitoring-grid">
        <div className="lp-monitoring-copy"><div className="lp-section-index">02 <span>AFTER THE LAUNCH</span></div><h2 id="monitoring-title">Launch is a moment. <br /><span>Your page <br />keeps moving.</span></h2><p>Start a campaign watch to keep checking its current destinations. Each scheduled run refreshes the campaign from Meta before inspecting the pages.</p><ul><li><Icon name="check" size={16} /> 15-minute inspections on paid plans</li><li><Icon name="check" size={16} /> Current Meta destinations</li><li><Icon name="check" size={16} /> Changes recorded as incidents</li></ul><a href="#product-example" className="lp-light-link" onClick={showMonitoring}>Explore campaign watch <Icon name="arrow" size={18} /></a></div>
        <div className="lp-watch-illustration"><div className="lp-watch-orbit" aria-hidden="true"><span /><span /></div><div className="lp-watch-cadence"><span>15<span>min</span></span><p>BETWEEN SCHEDULED CHECKS</p></div><div className="lp-watch-card"><div className="lp-watch-card-top"><span><Icon name="watch" size={16} /> Campaign watch</span><span className="lp-watch-tag">EXAMPLE</span></div><div className="lp-watch-row"><span className="lp-watch-node is-baseline"><Icon name="check" size={13} /></span><div><span>BASELINE PRICE</span><strong>$89.00 <small>USD</small></strong></div><span className="lp-watch-row-note">Reference saved</span></div><div className="lp-watch-row"><span className="lp-watch-node is-current"><Icon name="globe" size={13} /></span><div><span>LATEST INSPECTION</span><strong>$99.00 <small>USD</small></strong></div><span className="lp-watch-row-note">A change detected</span></div><div className="lp-watch-result"><Icon name="warning" size={18} /><span>Price changed. Evidence recorded.</span><Icon name="arrow" size={15} /></div></div><p className="lp-watch-caption">A reference point. A fresh inspection. A visible change.</p></div>
      </div></section>

      <section className="lp-workflow lp-container lp-section" id="how-it-works" aria-labelledby="workflow-title"><div className="lp-workflow-heading"><div><div className="lp-section-index">03 <span>YOUR FIRST CLEARER PICTURE</span></div><h2 id="workflow-title">A clearer view <br />in three moves.</h2></div><a href="#/signup" className="lp-text-link">Make your first move <Icon name="arrow" size={18} /></a></div><div className="lp-steps">{[
        ["01", "meta", "Connect Meta.", "Choose the ad accounts you want in your workspace."],
        ["02", "shield", "Check a campaign.", "Review its destinations and the findings that need your judgment."],
        ["03", "watch", "Keep watch.", "Turn on monitoring for the campaigns you want to follow after launch."],
      ].map(([number, icon, title, copy]) => <article key={number}><div className="lp-step-top"><span>{number}</span><Icon name={icon} size={25} /></div><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

      <section className="lp-pricing lp-container lp-section" id="pricing" aria-labelledby="pricing-title"><div className="lp-pricing-header"><div><div className="lp-section-index">04 <span>A PLAN FOR YOUR NEXT CHAPTER</span></div><h2 id="pricing-title">Start with clarity.<br />Grow your coverage.</h2></div><p>A useful first look, on us. Then a predictable monthly plan for the pages your campaigns depend on.</p></div><PricingCards publicPage /><AgencyNote publicPage /><div className="lp-pricing-footnote"><p><strong>No credit card to explore.</strong> Your 14-day monitoring preview starts with your first watch. Trial inspections run every 30 minutes. Saved reports stay available when the trial ends.</p><p><strong>One ad. One analysis.</strong> All supported checks are included. Monthly allowances renew each billing period. Paid subscribers can add 100 analyses for $15, valid for 90 days. Prices are in USD; applicable tax is shown at checkout.</p></div></section>

      <section className="lp-faq lp-container lp-section" id="questions" aria-labelledby="questions-title"><div className="lp-section-intro"><div className="lp-section-index">05 <span>A FEW GOOD QUESTIONS</span></div><h2 id="questions-title">The details <br />matter here, too.</h2></div><div className="lp-faq-list">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true"><Icon name="close" size={14} /></span></summary><p>{answer}</p></details>)}</div></section>

      <section className="lp-final-cta lp-container" aria-labelledby="final-cta-title"><div className="lp-cta-mark" aria-hidden="true"><Icon name="watch" size={31} /></div><div className="lp-eyebrow">A BETTER HANDOFF STARTS HERE</div><h2 id="final-cta-title">Give your next click <br /><span>a better landing.</span></h2><p>Bring your campaigns and landing pages into the same view.</p><a href="#/signup" className="lp-button">Start your free preview <Icon name="arrow" size={17} /></a><p className="lp-final-login">Already have an account? <a href="#/login">Log in <Icon name="arrow" size={13} /></a></p></section>
    </main>

    <footer className="lp-footer lp-container"><div className="lp-footer-top"><a href="/" className="lp-brand-link" aria-label="SteadySignal home"><Brand /></a><p>Built for the handoff <br />between ad and page.</p><nav aria-label="Footer navigation"><a href="#product">The product</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><a href="#questions">Questions</a></nav><nav aria-label="Account navigation"><a href="#/login">Log in</a><a href="#/signup">Create a workspace <Icon name="arrow" size={13} /></a></nav></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} SteadySignal</span><span>A clearer signal. A steadier campaign.</span><a href="#landing-content">Back to top ↑</a></div></footer>
  </div>;
}
