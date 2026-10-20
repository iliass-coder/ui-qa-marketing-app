export function resolveRoute(hash = "", search = "") {
  const params = new URLSearchParams(search);
  if (params.has("sso_error") || params.has("email_verified")) return { page: "login" };

  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const parts = path.split("/").filter(Boolean);
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
  const pages = ["login", "signup", "overview", "campaigns", "site-watch", "settings"];
  return { page: pages.includes(parts[0]) ? parts[0] : "home" };
}
