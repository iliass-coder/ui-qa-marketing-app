export function campaignIsLive(campaign, now = Date.now()) {
  const status = String(campaign?.status || "").toUpperCase();
  if (status !== "ACTIVE") return false;
  return !campaign?.startAt || new Date(campaign.startAt).getTime() <= now;
}

export function campaignPhase(campaign, now = Date.now()) {
  if (campaignIsLive(campaign, now)) return "Live";
  if (campaign?.startAt && new Date(campaign.startAt).getTime() > now) return "Scheduled";
  return "Draft / paused";
}

export function statusTone(status) {
  switch (String(status || "").toUpperCase()) {
    case "PASS":
    case "RESOLVED":
    case "COMPLETED":
    case "CONNECTED":
    case "ACTIVE":
      return "good";
    case "WARNING":
    case "STALE":
    case "QUEUED":
    case "RUNNING":
      return "caution";
    case "FAIL":
    case "OPEN":
    case "FAILED":
    case "ERROR":
    case "EXPIRED":
      return "bad";
    default:
      return "neutral";
  }
}

export function formatDate(value, options = {}) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options
  }).format(date);
}

export function valueText(value) {
  if (value == null || value === "") return "Not available";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
