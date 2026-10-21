import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { PLANS, AGENCY, planFeatures } from "./plans.js";
import "./billing.css";

const date = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";

export function PricingCards({ billing, busy, onChoose, publicPage = false }) {
  return <div className="pricing-cards">{PLANS.map((plan) => <article className={`pricing-card ${plan.featured ? "pricing-featured" : ""}`} key={plan.id}>
    <div className="pricing-card-top"><span className="pricing-plan-name">{plan.name}</span>{plan.featured && <span className="pricing-label">MORE ROOM TO GROW</span>}</div>
    <p className="pricing-description">{plan.description}</p>
    <div className="pricing-amount"><strong>${plan.price}</strong><span>{plan.id === "FREE" ? "to get started" : "/ month"}</span></div>
    <p className="pricing-note">{plan.note}</p>
    {publicPage ? <a className={`pricing-action ${plan.featured ? "is-primary" : ""}`} href={plan.id === "FREE" ? "#/signup" : `#/signup?plan=${plan.id}`}>{plan.cta}<Icon name="arrow" size={16} /></a>
      : plan.id === "FREE" ? <span className="pricing-current">{billing.plan === "FREE" ? "Your current plan" : "Your original preview stays in your history"}</span>
        : <button className={`pricing-action ${plan.featured ? "is-primary" : ""}`} type="button" disabled={Boolean(busy) || billing.plan === plan.id || !billing.checkoutAvailable} onClick={() => onChoose(plan.id)}>{busy === plan.id ? "Opening Stripe…" : billing.plan === plan.id ? "Your current plan" : plan.cta}<Icon name="arrow" size={16} /></button>}
    <ul className="pricing-features">{planFeatures(plan).map((feature) => <li key={feature}><Icon name="check" size={15} /><span>{feature}</span></li>)}</ul>
  </article>)}</div>;
}

export function AgencyNote({ contactEmail, publicPage = false, onContact }) {
  return <div className="pricing-agency"><span className="pricing-agency-icon"><Icon name="campaigns" size={24} /></span><div><strong>A larger portfolio deserves a conversation.</strong><p>Agency starts at ${AGENCY.price}/month: up to {AGENCY.accounts} ad accounts, {AGENCY.pages} pages, and {AGENCY.analyses.toLocaleString()} monthly analyses. Availability and fit confirmed together.</p></div>{contactEmail ? <a className="text-link" href={`mailto:${contactEmail}?subject=SteadySignal%20Agency`} onClick={onContact}>Talk about Agency <Icon name="arrow" size={15} /></a> : publicPage ? <a className="text-link" href="#/signup?plan=AGENCY">Explore Agency <Icon name="arrow" size={15} /></a> : <span className="pricing-agency-note">Agency access is available by arrangement. Contact your workspace administrator.</span>}</div>;
}

function UsageMeter({ label, used, limit, note }) {
  return <article className="billing-usage-card"><span>{label}</span><div><strong>{used.toLocaleString()}</strong><span>/ {limit.toLocaleString()}</span></div><progress value={Math.min(used, limit)} max={Math.max(1, limit)} aria-label={`${label}: ${used} of ${limit}`} /><p>{note}</p></article>;
}

export function BillingNotice({ billing }) {
  if (!billing) return null;
  const expired = billing.trialState === "expired" && billing.plan === "FREE";
  const blocked = billing.monitoredPages.blocked.length;
  const low = billing.analyses.remaining <= 0;
  const accountOverflow = billing.adAccounts.used > billing.adAccounts.limit;
  return <div className={`billing-notice ${expired || blocked || accountOverflow || low ? "billing-notice-warning" : ""}`} role="status"><Icon name="shield" size={18} /><div><strong>{expired ? "Your monitoring preview has ended" : accountOverflow ? "Review your selected Meta accounts" : blocked ? "Some landing pages need more coverage" : low ? "Your analysis allowance is used" : billing.planName}</strong><span>{expired ? "Choose a plan to resume your watches. Your saved reports are still available." : accountOverflow ? `Your plan covers ${billing.adAccounts.limit} selected Meta accounts. Choose which accounts to keep in Campaigns; accounts outside the allowance are not inspected.` : blocked ? `${blocked} page${blocked === 1 ? " is" : "s are"} outside your current coverage. Existing covered pages continue to be inspected.` : low ? "Existing watches continue. Choose a plan or add analyses to run more checks." : billing.trialState === "not_started" ? "10 analyses to explore. Your 14-day monitoring trial starts with your first watch." : billing.trialState === "active" ? `Your monitoring trial ends ${date(billing.trialEndsAt)}. No card on file, no automatic charge.` : `${billing.analyses.remaining.toLocaleString()} analyses available · ${billing.monitoredPages.used}/${billing.monitoredPages.limit} monitored pages`}</span></div><a href="#/billing">{expired || blocked || accountOverflow || low ? "Review your plan" : "Plan & usage"}<Icon name="arrow" size={14} /></a></div>;
}

export function BillingPage({ billing, request, reload, route }) {
  const [busy, setBusy] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const returnHandled = useRef("");
  useEffect(() => {
    if (route.checkout !== "success" || returnHandled.current === (route.sessionId || "portal")) return;
    returnHandled.current = route.sessionId || "portal";
    let active = true;
    const sync = async () => {
      setBusy("refresh"); setNotice("Confirming your payment with Stripe…");
      try {
        const result = await request("/api/billing/refresh", { method: "POST", body: { sessionId: route.sessionId || null } });
        if (active) { await reload(); setNotice(result.plan !== "FREE" ? "Your subscription is up to date." : "Your payment is still being confirmed. Refresh shortly; your access updates after Stripe confirms payment."); }
      } catch (e) { if (active) { setError(e.message); setNotice(""); } }
      finally { if (active) setBusy(""); }
    }; sync(); return () => { active = false; returnHandled.current = ""; };
  }, [route.checkout, route.sessionId, request]);
  const openStripe = async (path, body, action) => {
    setBusy(action); setError("");
    try {
      const result = await request(path, { method: "POST", ...(body ? { body } : {}) });
      const url = new URL(result.url);
      if (url.protocol !== "https:" || !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)) throw new Error("Stripe returned an unexpected checkout link.");
      window.location.assign(url.href);
    } catch (e) { setError(e.message); setBusy(""); }
  };
  const refresh = async () => { setBusy("refresh"); setError(""); try { await request("/api/billing/refresh", { method: "POST", body: {} }); await reload(); setNotice("Plan and usage refreshed."); } catch(e) { setError(e.message); } finally { setBusy(""); } };
  return <>
    <div className="page-heading"><div><div className="eyebrow">A LITTLE MORE PEACE OF MIND</div><h1>Your plan. Your coverage.</h1><p>Know what is protected, what you have used, and where there is room to grow.</p></div><button className="button secondary" disabled={Boolean(busy)} onClick={refresh}><Icon name="refresh" size={16} />Refresh</button></div>
    {route.plan && <div className="alert" role="status">{route.plan === "AGENCY" ? "Agency access is arranged individually. Review the offer below and contact us about availability." : `You selected ${route.plan === "GROWTH" ? "Growth" : "Starter"}. Start with your free preview or choose your plan below.`}</div>}
    {error && <div className="alert error" role="alert">{error}</div>}{notice && <div className="alert" role="status">{notice}</div>}
    {route.checkout === "canceled" && <div className="alert" role="status">Checkout closed. Your plan has not changed.</div>}
    {!billing.checkoutAvailable && <div className="alert" role="status">Paid checkout is being set up. Your free preview is available; contact your workspace administrator to activate paid billing.</div>}
    <section className="panel billing-current"><div><span className="eyebrow">CURRENT PLAN</span><h2>{billing.planName}</h2><p>{billing.plan === "FREE" ? billing.trialState === "not_started" ? "Your monitoring trial starts when you enable your first watch." : billing.trialState === "expired" ? "Monitoring is paused. Choose a plan to resume coverage." : `Your 14-day monitoring trial ends ${date(billing.trialEndsAt)}.` : billing.cancelAtPeriodEnd ? `Cancels ${date(billing.periodEnd)}. Your paid coverage continues until then.` : `Your next billing period starts ${date(billing.periodEnd)}.`}</p><small>One shared allowance across your workspace. {billing.monitoringIntervalMinutes}-minute inspections.</small></div>{billing.hasCustomer && <button className="button secondary" disabled={Boolean(busy) || !billing.checkoutAvailable} onClick={() => openStripe("/api/billing/portal", null, "portal")}>{busy === "portal" ? "Opening Stripe…" : "Manage subscription & invoices"}<Icon name="arrow" size={15} /></button>}</section>
    {billing.subscriptionStatus === "past_due" && <div className="alert error" role="status">A payment needs your attention. Update your payment method in Stripe to keep your coverage active.</div>}
    <div className="billing-usage-grid"><UsageMeter label="Included ad analyses" used={billing.analyses.used + billing.analyses.reserved} limit={billing.analyses.limit} note={`${billing.analyses.reserved} reserved for queued or running checks.${billing.analyses.resetAt ? ` Resets ${date(billing.analyses.resetAt)}.` : " Preview analyses do not renew."}`} /><UsageMeter label="Monitored landing pages" used={billing.monitoredPages.used} limit={billing.monitoredPages.limit} note="A shared URL uses one slot across campaigns. Distinct query variants count separately." /><UsageMeter label="Selected Meta accounts" used={billing.adAccounts.used} limit={billing.adAccounts.limit} note="Choose the accounts you want to sync in Campaigns." /></div>
    <div className="billing-topup panel"><div><h2>A busy launch month?</h2><p>Add 100 ad analyses for $15. Valid for 90 days; monitoring stays on your plan.</p><small>{billing.analyses.purchasedRemaining} purchased analyses remaining{billing.creditPacks.length ? ` · Next expiry ${date(billing.creditPacks[0].expiresAt)}` : ""}</small></div><button className="button secondary" disabled={Boolean(busy) || billing.plan === "FREE" || !billing.checkoutAvailable} onClick={() => openStripe("/api/billing/topup", null, "topup")}>{busy === "topup" ? "Opening Stripe…" : "Add 100 analyses · $15"}</button></div>
    <PricingCards billing={billing} busy={busy} onChoose={(plan) => openStripe("/api/billing/checkout", { plan }, plan)} /><AgencyNote contactEmail={billing.contactEmail} onContact={async (event) => { event.preventDefault(); setBusy("agency"); setError(""); try { await request("/api/billing/agency-request", { method: "POST" }); window.location.assign(`mailto:${billing.contactEmail}?subject=SteadySignal%20Agency`); } catch (e) { setError(e.message); } finally { setBusy(""); } }} />
    <section className="panel billing-explainer"><h2>Simple units. Clear boundaries.</h2><p>One analysis checks one ad against its landing page, including all supported checks. A campaign with 20 ads uses 20 analyses. Opening reports, failed jobs, and automatic retries do not use extra analyses. Scheduled monitoring is included in your page allowance.</p><p>Monthly analyses reset each billing period. Purchased packs expire after 90 days. When analyses run out, existing watches continue. If coverage exceeds your page allowance, existing allocated pages keep their slots; extra destinations wait for an upgrade or a freed slot.</p><p>Changes in Stripe can reduce your limits immediately. Review your active watches and selected accounts before downgrading. Optional automatic pausing requires two failed inspections; at these intervals, spend can continue before a pause takes effect.</p></section>
    {billing.accounts.length > 0 && <section className="panel billing-account-usage"><h2>Usage by Meta account</h2><p>Allowances are shared across the workspace. A URL shared by accounts appears in each row and counts once toward the workspace page limit.</p><div className="billing-table-wrap"><table><thead><tr><th>Ad account</th><th>Analyses used</th><th>Reserved</th><th>Monitored pages</th></tr></thead><tbody>{billing.accounts.map((a) => <tr key={a.id}><td>{a.name}<small>{a.selected ? "Selected" : "Not selected"}</small></td><td>{a.analysesUsed}</td><td>{a.analysesReserved}</td><td>{a.monitoredPages}</td></tr>)}</tbody></table></div></section>}
    {billing.monitoredPages.blocked.length > 0 && <section className="panel billing-blocked"><h2>Pages awaiting coverage</h2><p>These pages are outside your current allowance. Upgrade or stop another watch to free capacity.</p><ul>{billing.monitoredPages.blocked.map((url) => <li key={url}>{url}</li>)}</ul><a className="text-link" href="#/site-watch">Manage campaign watches <Icon name="arrow" size={15} /></a></section>}
  </>;
}
