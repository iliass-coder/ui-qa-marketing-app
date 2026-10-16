export function resolveRoute(hash = "", search = "") {
  const params = new URLSearchParams(search);
  if (params.has("sso_error") || params.has("email_verified")) return { page: "login" };

  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "report" && parts[1]) return { page: "report", id: parts[1] };
  const pages = ["login", "signup", "overview", "campaigns", "site-watch", "settings"];
  return { page: pages.includes(parts[0]) ? parts[0] : "home" };
}
