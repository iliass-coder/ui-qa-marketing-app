// Explicit events use our same-origin API. PostHog credentials never enter this bundle.
const CHOICE_KEY = "steadysignal_analytics_choice";
let choiceInMemory;
let configuration;
let configurationPromise;
let listening = false;
let lastVisit;
const viewedReports = new Set();

function stored(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function save(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* Choice still works for this page. */ }
}

function cookie(name, value, days = 180) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${days * 86400}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

function cookieValue(name) {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function analyticsChoice() {
  return choiceInMemory ?? stored(CHOICE_KEY);
}

export function publicAnalyticsPage(pathname, hash) {
  if (!["/", "/index.html"].includes(pathname)) return null;
  if (!hash.startsWith("#/")) return "landing";
  const match = /^#\/(signup|login)(?:\?|$)/.exec(hash);
  return match ? match[1] : null;
}

export function campaignLabel(value) {
  return typeof value === "string" && value.length <= 100
    && /^[\p{L}\p{N} ._:/-]*$/u.test(value) && !value.includes("://") ? value : "";
}

function testMode() {
  const requested = new URLSearchParams(window.location.search).get("analytics_test");
  if (requested === "1" || requested === "0") {
    save("steadysignal_analytics_test", requested);
    cookie("CC_ANALYTICS_TEST", requested, requested === "1" ? 1 : 0);
  }
  const active = requested === "1" || (requested !== "0" && stored("steadysignal_analytics_test") === "1");
  if (active) cookie("CC_ANALYTICS_TEST", "1", 1);
  return active;
}

async function post(path, payload) {
  try {
    const response = await fetch(path, {
      method: "POST", credentials: "same-origin", keepalive: true,
      headers: { "Content-Type": "application/json", "X-Gatekeeper-Request": "1" },
      body: JSON.stringify(payload)
    });
    return response.ok;
  } catch { return false; }
}

async function visit() {
  if (!configuration?.enabled || analyticsChoice() !== "allow") return;
  const page = publicAnalyticsPage(window.location.pathname, window.location.hash);
  if (!page || lastVisit === page) return;
  let visitorId = cookieValue("CC_ANALYTICS_VISITOR");
  if (!/^[0-9a-f-]{36}$/i.test(visitorId || "")) visitorId = window.crypto.randomUUID();
  cookie("CC_ANALYTICS_VISITOR", visitorId);
  const params = new URLSearchParams(window.location.search);
  let referrer = "";
  try { referrer = new URL(document.referrer).hostname; } catch { /* No external referrer. */ }
  lastVisit = page;
  const accepted = await post("/api/analytics/visit", {
    eventId: window.crypto.randomUUID(), visitorId, page,
    source: campaignLabel(params.get("utm_source")), medium: campaignLabel(params.get("utm_medium")),
    campaign: campaignLabel(params.get("utm_campaign")), referrer: campaignLabel(referrer), test: testMode()
  });
  if (!accepted && lastVisit === page) lastVisit = null;
}

export function chooseAnalytics(choice) {
  if (!["allow", "deny"].includes(choice)) return;
  choiceInMemory = choice;
  save(CHOICE_KEY, choice);
  cookie("CC_ANALYTICS_CHOICE", choice);
  if (choice === "deny") cookie("CC_ANALYTICS_VISITOR", "", 0);
  else void visit();
  window.dispatchEvent(new Event("steadysignal-analytics-choice"));
}

export function startAnalytics() {
  if (!configurationPromise) {
    testMode();
    configurationPromise = fetch("/api/analytics/config", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : { enabled: false })
      .catch(() => ({ enabled: false }))
      .then((result) => {
        configuration = result;
        if (result.enabled && !listening) {
          listening = true;
          window.addEventListener("hashchange", visit);
          void visit();
        }
        return result;
      });
  }
  return configurationPromise;
}

// A completed report is a product outcome, recorded with a workspace ID only.
export async function recordReportView(runId) {
  if (!runId || viewedReports.has(runId)) return;
  if (await post("/api/analytics/report-view", { runId })) viewedReports.add(runId);
}
