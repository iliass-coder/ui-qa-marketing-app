import { valueText } from "./domain.js";

export const INCIDENT_REPORT_LIMIT = 50;

const ISSUE_REASONS = {
  availability: "Page unavailable",
  inspection: "Page check needs review",
  http_status: "Previous HTTP status change",
  redirect: "Page destination changed",
  prices: "Price changed",
  dates: "Previous date-change alert",
  claims: "Watched claim missing",
  content: "Page content changed",
  stock_status: "Product may be out of stock",
  server_response_time: "Slow server response",
  copy_quality: "Spelling or grammar needs review",
  product_consistency: "Ad and page content differ",
  promotion_consistency: "Ad and page offers differ",
  offer_eligibility: "Offer or delivery claim needs review",
  market_language: "Campaign language needs review"
};

export function incidentType(type = "") {
  const value = type || "other";
  if (value.startsWith("qa:")) return value.split(":")[1];
  return value.startsWith("claim:") ? "claims" : value;
}

export function incidentTypeLabel(type) {
  return ISSUE_REASONS[incidentType(type)] || "Page warning needs review";
}

function seenAt(incident) {
  return Date.parse(incident.lastSeenAt || incident.firstSeenAt || incident.createdAt) || 0;
}

export function groupIncidents(incidents = []) {
  const groups = new Map();
  for (const incident of [...incidents].sort((a, b) => seenAt(b) - seenAt(a))) {
    const type = issueCategory(incident);
    if (!groups.has(type)) groups.set(type, []);
    groups.get(type).push(incident);
  }
  return [...groups].map(([type, records]) => {
    const open = records.filter((incident) => incident.status === "OPEN");
    const intentional = records.filter((incident) => incident.status === "INTENTIONAL");
    const affected = open.length ? open : intentional.length ? intentional : records;
    return {
      type,
      latest: records[0],
      representative: affected[0],
      totalCount: records.length,
      openCount: open.length,
      intentionalCount: intentional.length,
      pageCount: new Set(affected.map((incident) => incident.siteId || incident.evidenceJson?.url).filter(Boolean)).size
    };
  }).sort((a, b) => Number(b.openCount > 0) - Number(a.openCount > 0)
    || Number(b.type === "INCIDENT") - Number(a.type === "INCIDENT") || seenAt(b.latest) - seenAt(a.latest));
}

export function incidentReportHref({ campaignId = "", type = "", status = "", category = "" } = {}) {
  const params = new URLSearchParams();
  if (campaignId) params.set("campaign", campaignId);
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  if (["INCIDENT", "WARNING"].includes(category)) params.set("category", category);
  return `#/incidents${params.size ? `?${params}` : ""}`;
}

export function issueCategory(issue) {
  if (["INCIDENT", "WARNING"].includes(issue.category)) return issue.category;
  const evidence = issue.evidenceJson || {};
  const status = Number(evidence.httpStatus);
  return issue.type === "availability" && evidence.errorCode === "HTTP_ERROR"
    && (status === 404 || status === 410 || status >= 500 && status <= 599) ? "INCIDENT" : "WARNING";
}

export function issueCounts(issues = []) {
  const open = issues.filter((issue) => issue.status === "OPEN");
  return { incidents: open.filter((issue) => issueCategory(issue) === "INCIDENT").length,
    warnings: open.filter((issue) => issueCategory(issue) === "WARNING").length };
}

export function watchState(item, issues = [], billing = {}) {
  if (!billing.monitoringActive) return { value: "UNKNOWN", label: "Coverage paused" };
  if (!item?.monitoringEnabled) return { value: "UNKNOWN", label: "Watch paused" };
  const counts = issueCounts(issues);
  if (counts.incidents) return { value: "FAIL", label: issues.some((issue) => issue.status === "OPEN" && issue.pauseState === "PAUSED_AUTOMATICALLY") ? "Paused automatically" : "Incident detected" };
  if (counts.warnings) return { value: "WARNING", label: "Warnings to review" };
  if (!item.lastMonitoringAt) return { value: "UNKNOWN", label: "Waiting for first check" };
  if (!item.monitoringDestinationCount) return { value: "UNKNOWN", label: "No destinations" };
  if (billing.monitoredPages?.blocked?.length || billing.adAccounts?.used > billing.adAccounts?.limit) return { value: "WARNING", label: "Review coverage" };
  return { value: "PASS", label: "No open issues" };
}

export function issueTitle(issue) {
  if (issueCategory(issue) === "INCIDENT") return "Page unavailable";
  if (issue.type === "availability") return "Page check needs review";
  return incidentTypeLabel(issue.type);
}

export function issueValue(issue, value) {
  const unwrapped = value?.value ?? value;
  if (issue.type === "server_response_time" && Number.isFinite(Number(unwrapped))) return `${(Number(unwrapped) / 1000).toFixed(1)} seconds`;
  return incidentValueText(value);
}

export function safePageUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; }
  catch { return null; }
}

export function incidentValueText(value) {
  const unwrapped = value?.value ?? value;
  if (Array.isArray(unwrapped) && unwrapped.length && unwrapped.every((price) => price && typeof price === "object" && "amount" in price && "currency" in price)) {
    return unwrapped.map((price) => price.currency === "UNKNOWN" ? `${price.amount} (currency unknown)` : `${price.amount} ${price.currency}`).join(", ");
  }
  return valueText(unwrapped);
}
