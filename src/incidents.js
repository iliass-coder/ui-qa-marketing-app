import { valueText } from "./domain.js";

export const INCIDENT_REPORT_LIMIT = 50;

export const INCIDENT_TYPES = {
  availability: "Page availability",
  http_status: "HTTP status changed",
  redirect: "Redirect changed",
  prices: "Price or currency changed",
  dates: "Date changed",
  claims: "Watched claim missing",
  content: "Significant content change"
};

export function incidentType(type = "") {
  const value = type || "other";
  return value.startsWith("claim:") ? "claims" : value;
}

export function incidentTypeLabel(type) {
  return INCIDENT_TYPES[incidentType(type)] || "Other page change";
}

function seenAt(incident) {
  return Date.parse(incident.lastSeenAt || incident.firstSeenAt || incident.createdAt) || 0;
}

export function groupIncidents(incidents = []) {
  const groups = new Map();
  for (const incident of [...incidents].sort((a, b) => seenAt(b) - seenAt(a))) {
    const type = incidentType(incident.type);
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
  }).sort((a, b) => Number(b.openCount > 0) - Number(a.openCount > 0) || seenAt(b.latest) - seenAt(a.latest));
}

export function incidentReportHref({ campaignId = "", type = "", status = "" } = {}) {
  const params = new URLSearchParams();
  if (campaignId) params.set("campaign", campaignId);
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  return `#/incidents${params.size ? `?${params}` : ""}`;
}

export function incidentValueText(value) {
  const unwrapped = value?.value ?? value;
  if (Array.isArray(unwrapped) && unwrapped.length && unwrapped.every((price) => price && typeof price === "object" && "amount" in price && "currency" in price)) {
    return unwrapped.map((price) => price.currency === "UNKNOWN" ? `${price.amount} (currency unknown)` : `${price.amount} ${price.currency}`).join(", ");
  }
  return valueText(unwrapped);
}
