export function resolveRoute(hash = "", search = "") {
  const params = new URLSearchParams(search);
  if (params.has("sso_error") || params.has("email_verified")) return { page: "login" };

  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  if (["reset-password", "delete-account"].includes(parts[0])) {
    return { page: parts[0], token: new URLSearchParams(query).get("token") || "" };
  }
  const intent = new URLSearchParams(query).get("plan");
  if (["signup", "login"].includes(parts[0]) && ["STARTER", "GROWTH", "AGENCY"].includes(intent)) return { page: parts[0], plan: intent };
  if (parts[0] === "billing") {
    const values = new URLSearchParams(query);
    return { page: "billing", checkout: values.get("checkout") || "", sessionId: values.get("session_id") || "", plan: intent || "" };
  }
  if (parts[0] === "settings" && new URLSearchParams(query).get("meta_error") === "denied") {
    return { page: "settings", metaError: "denied" };
  }
  if (parts[0] === "report" && parts[1]) return { page: "report", id: parts[1] };
  if (parts[0] === "site-watch") {
    const campaignId = new URLSearchParams(query).get("campaign");
    return campaignId ? { page: "site-watch", campaignId } : { page: "site-watch" };
  }
  if (parts[0] === "incidents") {
    const filters = new URLSearchParams(query);
    const route = { page: "incidents" };
    if (filters.get("campaign")) route.campaignId = filters.get("campaign");
    if (filters.get("type")) route.type = filters.get("type");
    if (filters.get("status")) route.status = filters.get("status");
    return route;
  }
  const pages = ["login", "signup", "forgot-password", "overview", "campaigns", "site-watch", "settings"];
  return { page: pages.includes(parts[0]) ? parts[0] : "home" };
}
