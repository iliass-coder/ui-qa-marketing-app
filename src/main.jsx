import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { campaignPhase, formatDate, statusTone, valueText } from "./domain.js";
import "./styles.css";

const request = async (path, options = {}) => {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-Gatekeeper-Request", "1");
  if (options.body && typeof options.body !== "string") {
    headers.set("Content-Type", "application/json");
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, { ...options, method, headers, credentials: "same-origin" });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.message || body.code || "";
    } catch {
      detail = "";
    }
    const error = new Error(detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
};

const actOnIncident = async (incident, action) => {
  const note = action === "resolve"
    ? window.prompt("Add a note about the requested resolution. A fresh check must verify recovery before the incident closes.")
    : action === "mark-intentional"
      ? window.prompt("Why is this page change intentional? A healthy snapshot is required.")
      : null;
  if (["resolve", "mark-intentional"].includes(action) && !note?.trim()) return;
  setBusy(`incident:${incident.id}`);
  setLoadError("");
  try {
    const result = await request(`/api/incidents/${incident.id}/${action}`, {
      method: "POST",
      ...(note ? { body: { note: note.trim() } } : {})
    });
    if (action !== "mark-intentional" && result?.id) {
      const complete = await waitFor("/api/jobs", result.id);
      if (complete.status === "FAILED") throw new Error(complete.errorMessage || "The incident check failed.");
    }
    await reload();
    setToast(action === "mark-intentional" ? "The change was marked intentional." : "Fresh inspection completed. Incident status reflects the backend's verified result.");
  } catch (error) {
    setLoadError(error.message);
  } finally {
    setBusy("");
  }
};

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function waitFor(path, id) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = await request(`${path}/${id}`);
    if (["COMPLETED", "FAILED"].includes(result.status)) return result;
    await sleep(1500);
  }
  throw new Error("The background check is taking longer than expected. Its status is still available in the app.");
}

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function routeFromHash() {
  const parts = window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "report" && parts[1]) return { page: "report", id: parts[1] };
  return { page: ["overview", "campaigns", "site-watch", "settings"].includes(parts[0]) ? parts[0] : "overview" };
}

function navigate(path) {
  window.location.hash = `/${path}`;
}

function Button({ children, kind = "secondary", className = "", ...props }) {
  return <button className={`button ${kind} ${className}`} {...props}>{children}</button>;
}

function Status({ value, label }) {
  const text = label || value || "Not checked";
  return <span className={`status ${statusTone(value)}`}><span className="status-dot" aria-hidden="true" />{text}</span>;
}

function Empty({ title, children, action }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">—</span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

function PageHeading({ eyebrow, title, children, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children && <p>{children}</p>}</div>{action && <div className="heading-actions">{action}</div>}</div>;
}

function Metric({ label, value, note, tone = "" }) {
  return <section className="metric-card"><div className={`metric-value ${tone}`}>{value}</div><div className="metric-label">{label}</div><div className="metric-note">{note}</div></section>;
}

function App() {
  const [auth, setAuth] = useState("loading");
  const [user, setUser] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [route, setRoute] = useState(routeFromHash);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");

  const loadApp = useCallback(async () => {
    setLoadError("");
    const [me, dashboard, meta, campaigns, sites, incidents, preferences] = await Promise.all([
      request("/api/me"),
      request("/api/dashboard"),
      request("/api/integrations/meta/status"),
      request("/api/campaigns"),
      request("/api/sites"),
      request("/api/incidents"),
      request("/api/notification-preferences")
    ]);
    setUser(me);
    setData({ dashboard, meta, campaigns, sites, incidents, preferences });
    setAuth("signed-in");
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    request("/api/me").then((me) => {
      setUser(me);
      setAuth("signed-in");
    }).catch((error) => {
      if (error.status === 401) setAuth("signed-out");
      else {
        setLoadError(error.message);
        setAuth("signed-out");
      }
    });
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (auth !== "signed-in") return;
    loadApp().catch((error) => setLoadError(error.message));
  }, [auth, loadApp]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const reload = async () => {
    try {
      await loadApp();
      return true;
    } catch (error) {
      setLoadError(error.message);
      return false;
    }
  };

  const login = async (event) => {
    event.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/auth/login", { method: "POST", body: { email: form.get("email"), password: form.get("password") } });
      setAuth("signed-in");
    } catch (error) {
      setLoginError(error.message === "INVALID_CREDENTIALS" ? "Email or password was not accepted." : error.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const runQa = async (campaignId) => {
    setBusy(`qa:${campaignId}`);
    setLoadError("");
    try {
      const run = await request(`/api/campaigns/${campaignId}/qa-runs`, { method: "POST" });
      const complete = await waitFor("/api/qa-runs", run.id);
      if (complete.status === "FAILED") throw new Error(complete.errorMessage || "The QA run failed.");
      await reload();
      setToast("QA is complete. The report shows backend findings and evidence.");
      navigate(`report/${campaignId}`);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const syncMeta = async () => {
    setBusy("sync");
    setLoadError("");
    try {
      const job = await request("/api/integrations/meta/sync", { method: "POST" });
      const complete = await waitFor("/api/jobs", job.id);
      if (complete.status === "FAILED") throw new Error(complete.errorMessage || "Meta sync failed.");
      await reload();
      setToast("Meta campaign data is up to date.");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const checkSite = async (siteId, message = "Page check completed.") => {
    setBusy(`site:${siteId}`);
    setLoadError("");
    try {
      const job = await request(`/api/sites/${siteId}/check-now`, { method: "POST" });
      const complete = await waitFor("/api/jobs", job.id, true);
      if (complete.status === "FAILED") throw new Error(complete.errorMessage || "The page check failed.");
      await reload();
      setToast(message);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const savePreferences = async (event) => {
    event.preventDefault();
    setBusy("preferences");
    const form = new FormData(event.currentTarget);
    try {
      await request("/api/notification-preferences", {
        method: "PATCH",
        body: {
          email: form.get("email"),
          incidentAlertsEnabled: form.get("incidentAlertsEnabled") === "on",
          recoveryAlertsEnabled: form.get("recoveryAlertsEnabled") === "on"
        }
      });
      await reload();
      setToast("Notification preferences saved.");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const createSite = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy("add-site");
    setLoadError("");
    try {
      await request("/api/sites", {
        method: "POST",
        body: { name: form.get("name"), url: form.get("url"), monitoringEnabled: true, monitoringIntervalMinutes: 30 }
      });
      formElement.reset();
      await reload();
      setToast("Page added. The backend will check it every 30 minutes.");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const updateSite = async (site, update) => {
    setBusy(`site-update:${site.id}`);
    try {
      await request(`/api/sites/${site.id}`, { method: "PATCH", body: update });
      await reload();
      setToast(update.monitoringEnabled === false ? "Monitoring paused for this page." : "Page settings updated.");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const archiveSite = async (site) => {
    if (!window.confirm(`Stop monitoring and archive ${site.name}? Historic checks will remain available.`)) return;
    setBusy(`site-update:${site.id}`);
    try {
      await request(`/api/sites/${site.id}`, { method: "DELETE" });
      await reload();
      setToast("Page archived. Its check history is retained.");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const disconnectMeta = async () => {
    if (!window.confirm("Disconnect the Meta account? Imported history will remain saved.")) return;
    try {
      await request("/api/integrations/meta", { method: "DELETE" });
      await reload();
      setToast("Meta account disconnected.");
    } catch (error) {
      setLoadError(error.message);
    }
  };

  if (auth === "loading") return <main className="center-state"><div className="spinner" /><p>Checking your secure session…</p></main>;
  if (auth === "signed-out") {
    return <main className="login-page"><div className="login-brand"><Brand /></div><section className="login-card">
      <div className="eyebrow">WORKSPACE ACCESS</div><h1>Welcome back.</h1><p>Sign in to review campaigns and monitored pages.</p>
      {loadError && <div className="alert error" role="alert">{loadError} Check that the backend is running, then try again.</div>}
      {loginError && <div className="alert error" role="alert">{loginError}</div>}
      <form onSubmit={login} className="form-stack">
        <label>Email address<input type="email" name="email" autoComplete="username" required maxLength="254" /></label>
        <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
        <Button kind="primary" type="submit" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</Button>
      </form><p className="fine-print">Your workspace owner provisions access. Credentials are verified by the backend.</p>
    </section></main>;
  }
  if (!data) return <main className="center-state"><div className="spinner" /><p>Loading workspace data…</p>{loadError && <p role="alert">{loadError} <button className="text-button" onClick={reload}>Try again</button></p>}</main>;

  const connection = data.meta?.connection;
  const account = data.meta?.accounts?.[0];
  const connected = connection?.status === "CONNECTED";
  const lastSync = connection?.lastSyncAt ? new Date(connection.lastSyncAt).getTime() : null;
  const metaSyncIsStale = connected && lastSync && Date.now() - lastSync > 24 * 60 * 60 * 1000;
  const activeNav = route.page === "report" ? "campaigns" : route.page;

  return <div className="app-shell">
    <aside className="sidebar">
      <a href="#/overview" className="brand-link" aria-label="SteadySignal overview"><Brand /></a>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <NavItem id="overview" active={activeNav === "overview"} icon="◫" label="Overview" />
        <NavItem id="campaigns" active={activeNav === "campaigns"} icon="↗" label="Campaigns" />
        <NavItem id="site-watch" active={activeNav === "site-watch"} icon="◉" label="Site watch" />
        <NavItem id="settings" active={activeNav === "settings"} icon="⚙" label="Settings" />
      </nav>
      <div className="sidebar-account">
        <div className="nav-caption">CONNECTED ACCOUNT</div>
        <div className="account-status"><span className={`signal-dot ${connected ? "online" : ""}`} /><span>{connected ? "Meta Ads" : "Meta not connected"}</span></div>
        <div className="account-sub">{account?.name || (connected ? "Syncing account…" : "Connect to import campaigns")}</div>
      </div>
      <div className="sidebar-bottom"><span>Campaign assurance</span><small>Read-only campaign access</small></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><span>{user?.workspace?.name || "Workspace"}</span><span aria-hidden="true">/</span><strong>{route.page === "report" ? "QA report" : route.page === "site-watch" ? "Site watch" : route.page[0].toUpperCase() + route.page.slice(1)}</strong></div>
        <div className="topbar-right"><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? "Meta Ads connected" : "Meta disconnected"} /><span className="topbar-user">{user?.user?.name || user?.user?.email}</span></div>
      </header>
      <div className="page-content">
        {!connected && <div className="alert connection-alert" role="status"><div><strong>Meta account disconnected</strong><span>Connect Meta to import real campaigns and run prelaunch QA.</span></div><Button kind="primary" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button></div>}
        {connection?.lastError && <div className="alert error" role="alert">Meta reports: {connection.lastError}. Reconnect or review the account configuration.</div>}
        {metaSyncIsStale && <div className="alert stale-alert" role="status">Meta campaign data was last synced {formatDate(connection.lastSyncAt)}. Sync now before relying on campaign status.</div>}
        {loadError && <div className="alert error" role="alert"><span>{loadError}</span><button className="alert-close" aria-label="Dismiss error" onClick={() => setLoadError("")}>×</button></div>}
        {route.page === "overview" && <Overview data={data} busy={busy} runQa={runQa} syncMeta={syncMeta} />}
        {route.page === "campaigns" && <Campaigns data={data} busy={busy} runQa={runQa} syncMeta={syncMeta} />}
        {route.page === "report" && <QaReport campaignId={route.id} refreshKey={data.campaigns?.find((item) => item.campaign?.id === route.id)?.lastQa?.id || ""} runQa={runQa} busy={busy} />}
        {route.page === "site-watch" && <SiteWatch data={data} busy={busy} checkSite={checkSite} actOnIncident={actOnIncident} createSite={createSite} updateSite={updateSite} archiveSite={archiveSite} />}
        {route.page === "settings" && <Settings data={data} busy={busy} syncMeta={syncMeta} disconnectMeta={disconnectMeta} savePreferences={savePreferences} />}
      </div>
      {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification">×</button></div>}
    </main>
  </div>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark">S<i /></span><span className="brand-name">steady signal<small>CAMPAIGN ASSURANCE</small></span></div>;
}

function NavItem({ id, active, icon, label }) {
  return <a className={`nav-item ${active ? "active" : ""}`} href={`#/${id}`} aria-current={active ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{icon}</span><span>{label}</span></a>;
}

function Overview({ data, busy, runQa, syncMeta }) {
  const { campaigns = [], sites = [], incidents = [], dashboard = {}, meta = {} } = data;
  const needsReview = campaigns.filter((item) => {
    const status = item.qaState || item.verdict;
    const campaign = item.campaign || {};
    return campaignPhase(campaign) !== "Live" && (!item.lastQa || ["FAIL", "WARNING", "STALE", "UNKNOWN"].includes(status));
  });
  const monitored = sites.filter((site) => site.monitoringEnabled);
  const openIncidents = incidents.filter((incident) => incident.status === "OPEN");
  const recent = [...campaigns].sort((a, b) => new Date(b.campaign?.updatedAt || 0) - new Date(a.campaign?.updatedAt || 0)).slice(0, 4);
  return <>
    <PageHeading eyebrow="WORKSPACE OVERVIEW" title="A steadier read on your campaigns." action={!meta.connection && <Button kind="primary" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}>Catch campaign and landing-page mismatches before launch, then keep watch on pages already live.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Imported campaigns" value={dashboard.importedCampaigns ?? campaigns.length} note={meta.accounts?.length ? `Across ${meta.accounts.length} connected ad account${meta.accounts.length === 1 ? "" : "s"}` : "From your connected Meta account"} />
      <Metric label="Need a closer look" value={needsReview.length} note={openIncidents.length ? `${openIncidents.length} active site incident${openIncidents.length === 1 ? "" : "s"}` : "Prelaunch findings and stale checks"} tone={needsReview.length ? "coral" : ""} />
      <Metric label="Pages monitored" value={`${dashboard.monitoredSites ?? monitored.length}`} note="Automatic checks every 30 minutes" tone="green" />
    </div>
    <div className="overview-grid">
      <section className="panel campaign-queue">
        <div className="panel-heading"><div><h2>Before the next dollar goes out</h2><p>Review upcoming campaigns and their latest real QA state.</p></div><Button onClick={() => navigate("campaigns")}>All campaigns</Button></div>
        {needsReview.length === 0 ? <Empty title={campaigns.length ? "No prelaunch campaign needs attention" : "No imported campaigns yet"}>{campaigns.length ? "Your backend reports no unchecked or non-passing campaigns." : meta.connection ? "Sync Meta Ads to import campaigns visible to the connected account." : "Connect a Meta Ads account to get started."}</Empty> :
          <div className="campaign-list">{needsReview.slice(0, 5).map((item) => <CampaignRow key={item.campaign.id} item={item} busy={busy} runQa={runQa} />)}</div>}
      </section>
      <section className="panel watch-summary">
        <div className="panel-heading compact"><div><h2>Site watch</h2><p>30-minute monitoring schedule</p></div><a className="text-link" href="#/site-watch">Open watch →</a></div>
        {monitored.length === 0 ? <Empty title="No monitored pages">Add a public destination to begin receiving backend checks.</Empty> :
          <div className="watch-list">{monitored.slice(0, 4).map((site) => <WatchSummary key={site.id} site={site} incident={openIncidents.find((item) => item.siteId === site.id)} />)}</div>}
        <div className="watch-footer"><span>Next scheduled check</span><strong>{formatDate(monitored.map((site) => site.nextCheckAt).filter(Boolean).sort()[0])}</strong></div>
      </section>
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><h2>Campaign queue</h2><p>Latest campaigns returned by Meta synchronization.</p></div><Button onClick={syncMeta} disabled={!meta.connection || busy === "sync"}>{busy === "sync" ? "Syncing…" : "Sync Meta Ads"}</Button></div>
      {recent.length === 0 ? <Empty title="No campaign data">When a Meta account is connected and synced, imported campaign status will appear here.</Empty> :
        <CampaignTable items={recent} busy={busy} runQa={runQa} />}
    </section>
  </>;
}

function CampaignRow({ item, busy, runQa }) {
  const c = item.campaign;
  const needsRun = !item.lastQa || item.qaState === "STALE" || item.qaState === "Not checked";
  return <article className="campaign-row">
    <div className="campaign-initial" aria-hidden="true">{(c.name || "C").slice(0, 1).toUpperCase()}</div>
    <div className="campaign-row-main"><a className="campaign-title" href={`#/report/${c.id}`}>{c.name}</a><div className="campaign-sub">{c.objective || "Meta campaign"} · {item.adCount ?? 0} ad{item.adCount === 1 ? "" : "s"}</div>
      <div className="campaign-inline-status"><Status value={item.verdict || item.qaState} label={item.qaState || "Not checked"} /><span>{campaignPhase(c)}</span></div>
    </div>
    {needsRun ? <Button kind="primary" onClick={() => runQa(c.id)} disabled={busy === `qa:${c.id}`}>{busy === `qa:${c.id}` ? "Checking…" : "Run QA"}</Button> : <Button onClick={() => navigate(`report/${c.id}`)}>View report</Button>}
  </article>;
}

function WatchSummary({ site, incident }) {
  return <a className="watch-item" href="#/site-watch"><span className={`watch-bullet ${incident ? "alert" : "ok"}`} aria-hidden="true" /><span className="watch-item-copy"><strong>{site.name}</strong><small>{incident ? incident.title : site.lastCheckedAt ? `Last checked ${formatDate(site.lastCheckedAt)}` : "Waiting for first check"}</small></span><Status value={incident ? "OPEN" : site.lastCheckedAt ? "PASS" : "UNKNOWN"} label={incident ? "Incident" : site.lastCheckedAt ? "Checked" : "Waiting"} /></a>;
}

function Campaigns({ data, busy, runQa, syncMeta }) {
  const { campaigns = [], meta = {} } = data;
  const [filter, setFilter] = useState("All campaigns");
  const rows = campaigns.filter((item) => {
    const phase = campaignPhase(item.campaign);
    if (filter === "Before launch") return phase !== "Live";
    if (filter === "Live") return phase === "Live";
    return true;
  });
  const nonLive = campaigns.filter((item) => campaignPhase(item.campaign) !== "Live");
  const needsAttention = nonLive.filter((item) => ["FAIL", "WARNING", "STALE"].includes(item.verdict)).length;
  return <>
    <PageHeading eyebrow="CAMPAIGN ASSURANCE" title="Campaigns to review." action={<Button onClick={syncMeta} disabled={!meta.connection || busy === "sync"}>{busy === "sync" ? "Syncing…" : "Sync Meta Ads"}</Button>}>Check the offer, destination, and tracking before a campaign goes live. Status and findings come from the connected account.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Needs attention" value={needsAttention} note="Latest backend QA verdicts" tone={needsAttention ? "coral" : ""} />
      <Metric label="Before launch" value={nonLive.length} note="Draft, paused, or scheduled Meta campaigns" />
      <Metric label="Currently live" value={campaigns.length - nonLive.length} note="Active status from Meta" tone="green" />
    </div>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Campaign queue</h2><p>Run a deterministic QA pass or inspect a saved report.</p></div></div>
      <div className="filter-tabs" role="group" aria-label="Filter campaigns">{["All campaigns", "Before launch", "Live"].map((name) => <button key={name} className={`filter-tab ${filter === name ? "selected" : ""}`} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div>
      {rows.length ? <CampaignTable items={rows} busy={busy} runQa={runQa} /> : <Empty title={campaigns.length ? "No campaigns in this view" : "No campaign data yet"}>{campaigns.length ? "Choose another campaign filter." : meta.connection ? "Sync Meta Ads to load campaigns from the connected account." : "Connect Meta Ads to import real campaigns."}</Empty>}
    </section>
  </>;
}

function CampaignTable({ items, busy, runQa }) {
  return <div className="table-wrap"><table className="data-table">
    <thead><tr><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col">Launch</th><th scope="col">Latest QA</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
    <tbody>{items.map((item) => {
      const campaign = item.campaign;
      const phase = campaignPhase(campaign);
      const status = item.qaState || "Not checked";
      return <tr key={campaign.id}>
        <td><div className="table-campaign"><span className="campaign-initial small" aria-hidden="true">{(campaign.name || "C").slice(0, 1).toUpperCase()}</span><span><a className="campaign-title" href={`#/report/${campaign.id}`}>{campaign.name}</a><small>{campaign.objective || "Meta Ads"} · {item.adCount ?? 0} ads</small></span></div></td>
        <td><Status value={phase === "Live" ? "ACTIVE" : "UNKNOWN"} label={phase} /></td>
        <td>{formatDate(campaign.startAt, { dateStyle: "medium", timeStyle: undefined })}</td>
        <td><Status value={item.verdict || "UNKNOWN"} label={status} /></td>
        <td className="action-cell">{item.lastQa && !["STALE", "Not checked"].includes(status) ? <Button onClick={() => navigate(`report/${campaign.id}`)}>View report</Button> : <Button kind="primary" disabled={busy === `qa:${campaign.id}`} onClick={() => runQa(campaign.id)}>{busy === `qa:${campaign.id}` ? "Checking…" : "Run QA"}</Button>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function QaReport({ campaignId, refreshKey, busy, runQa }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportVersion, setReportVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      request(`/api/campaigns/${campaignId}`),
      request(`/api/campaigns/${campaignId}/ads`)
    ]).then(async ([summary, ads]) => {
      const run = summary.lastQa;
      if (!run) {
        if (active) setDetail({ summary, ads, run: null, results: [], evidence: {} });
        return;
      }
      if (["QUEUED", "RUNNING"].includes(run.status)) {
        if (active) setDetail({ summary, ads, run, results: [], evidence: {} });
        waitFor("/api/qa-runs", run.id)
          .then(() => { if (active) setReportVersion((version) => version + 1); })
          .catch((e) => { if (active) setError(e.message); });
        return;
      }
      const report = await request(`/api/qa-runs/${run.id}/report`);
      if (active) setDetail({ summary, ads, run, results: report.results, evidence: report.evidence });
    }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [campaignId, refreshKey, reportVersion]);

  if (loading) return <div className="center-state inline"><div className="spinner" /><p>Loading the latest QA report…</p></div>;
  if (error) return <div className="alert error" role="alert">{error} <Button onClick={() => window.location.reload()}>Retry</Button></div>;
  if (!detail) return null;
  const campaign = detail.summary.campaign;
  const results = detail.results || [];
  const findings = results.filter((result) => ["FAIL", "WARNING", "UNKNOWN", "STALE"].includes(result.status));
  const sortedResults = [...results].sort((a, b) => severityOrder(a.severity, a.status) - severityOrder(b.severity, b.status));
  return <>
    <PageHeading eyebrow={`CAMPAIGN QA · ${campaign.name}`} title="Evidence before the next launch." action={<Button onClick={() => navigate("campaigns")}>← Campaigns</Button>}>
      The report uses the most recent backend run. Rerun after changing an ad or landing page.
    </PageHeading>
    <div className="report-summary">
      <div><div className="eyebrow">LATEST VERDICT</div><Status value={detail.summary.verdict || "UNKNOWN"} label={detail.summary.qaState || "Not checked"} /></div>
      <div><div className="eyebrow">CAMPAIGN STATUS</div><strong>{campaign.status || "Not reported"} · {campaignPhase(campaign)}</strong></div>
      <div><div className="eyebrow">LAST CHECKED</div><strong>{formatDate(detail.run?.completedAt || detail.run?.createdAt)}</strong></div>
      <Button kind="primary" disabled={busy === `qa:${campaignId}`} onClick={() => runQa(campaignId)}>{busy === `qa:${campaignId}` ? "Running QA…" : detail.run ? "Run QA again" : "Run QA"}</Button>
    </div>
    {!detail.run && <Empty title="This campaign has not been checked">Run QA to inspect its current ads, destinations, redirects, offers, and tracking parameters.</Empty>}
    {detail.run && ["QUEUED", "RUNNING"].includes(detail.run.status) && <div className="alert" role="status">A QA run is {detail.run.status.toLowerCase()}. Refresh this report in a moment to see its result.</div>}
    {detail.run?.status === "FAILED" && <div className="alert error" role="alert">{detail.run.errorMessage || "The latest QA run failed."}</div>}
    {detail.run && <div className="report-columns">
      <section className="panel creative-panel"><div className="eyebrow">META CAMPAIGN</div><h2>{campaign.name}</h2><p>{campaign.objective || "Objective not provided"} · {detail.summary.adCount} ads</p>
        {detail.ads.length === 0 ? <Empty title="No accessible ads">The connected Meta account did not return accessible creative data for this campaign.</Empty> : detail.ads.map((ad) => {
          const destination = safeExternalUrl(ad.destinationUrl);
          return <article className="creative-copy" key={ad.id}><div className="creative-type">{ad.name || "Ad creative"}</div>{ad.headline && <h3>{ad.headline}</h3>}<p>{ad.primaryText || "Primary text not available from Meta."}</p>{ad.description && <p className="muted-copy">{ad.description}</p>}{destination && <a href={destination} target="_blank" rel="noreferrer" className="destination-link">{destination}</a>}</article>;
        })}
      </section>
      <section className="panel finding-panel"><div className="panel-heading"><div><h2>What the backend checked</h2><p>{findings.length} finding{findings.length === 1 ? "" : "s"} need context or action.</p></div></div>
        {sortedResults.length === 0 ? <Empty title="No checks returned">The latest run has no result records yet.</Empty> : <div className="finding-list">{sortedResults.map((result) => <Finding key={result.id} result={result} evidence={detail.evidence[result.id] || []} />)}</div>}
      </section>
    </div>}
  </>;
}

function severityOrder(severity, status) {
  const rank = { critical: 0, major: 1, moderate: 2, minor: 3 };
  return (rank[String(severity || "").toLowerCase()] ?? 4) * 10 + (status === "FAIL" ? 0 : status === "WARNING" ? 1 : 2);
}

function nextStep(result) {
  const type = String(result.checkType || "").toLowerCase();
  if (type.includes("availability") || type.includes("destination") || type.includes("http")) return "Open the destination and confirm it loads before launch.";
  if (type.includes("redirect")) return "Review the final destination and confirm redirects lead to the intended offer.";
  if (type.includes("price") || type.includes("offer")) return "Align the offer details in the ad and landing page, then rerun QA.";
  if (type.includes("tracking") || type.includes("utm")) return "Add or correct campaign tracking parameters on the destination URL.";
  if (type.includes("claim") || type.includes("product") || type.includes("semantic")) return "Review the ad and page copy together; this check may need human judgment.";
  return "Review the evidence and rerun QA after making any changes.";
}

function Finding({ result, evidence }) {
  const [expanded, setExpanded] = useState(result.status !== "PASS");
  const label = result.checkType?.replaceAll("_", " ") || "Campaign check";
  const firstEvidence = evidence[0];
  return <article className={`finding ${statusTone(result.status)}`}>
    <button className="finding-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      <span className={`finding-icon ${statusTone(result.status)}`} aria-hidden="true">{result.status === "PASS" ? "✓" : result.status === "FAIL" ? "!" : "·"}</span>
      <span className="finding-heading"><strong>{label}</strong><small>{result.severity || "severity not specified"} severity</small></span>
      <Status value={result.status} /><span className="expand-caret" aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button>
    {expanded && <div className="finding-detail">
      <p>{result.humanMessage || "No explanation was provided for this check."}</p>
      <div className="evidence-grid"><div><span>Expected</span><strong>{valueText(result.expectedJson?.value ?? result.expectedJson)}</strong></div><div><span>Observed</span><strong>{valueText(result.observedJson?.value ?? result.observedJson)}</strong></div></div>
      {firstEvidence && <blockquote><span>Evidence · {firstEvidence.source || firstEvidence.evidenceType}</span><p>{firstEvidence.excerpt || "No text excerpt was recorded."}</p></blockquote>}
      <div className="suggested-step"><strong>Suggested next step</strong><p>{nextStep(result)}</p></div>
      {result.coverageJson?.length > 0 && <details className="coverage-details"><summary>Coverage limits</summary><ul>{result.coverageJson.map((item) => <li key={item}>{item}</li>)}</ul></details>}
    </div>}
  </article>;
}

function SiteWatch({ data, busy, checkSite, actOnIncident, createSite, updateSite, archiveSite }) {
  const { sites = [], incidents = [] } = data;
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const selected = sites.find((site) => site.id === selectedId) || null;
  useEffect(() => {
    if (!sites.length) { setSelectedId(""); return; }
    if (!sites.some((site) => site.id === selectedId)) setSelectedId(sites[0].id);
  }, [sites, selectedId]);
  useEffect(() => {
    if (!selected) { setDetails(null); return; }
    let active = true;
    setDetails(null);
    setDetailError("");
    Promise.all([
      request(`/api/sites/${selected.id}`),
      request(`/api/sites/${selected.id}/snapshots`),
      request(`/api/sites/${selected.id}/incidents`)
    ]).then(([summary, snapshots, pageIncidents]) => {
      if (active) setDetails({ summary, snapshots, incidents: pageIncidents });
    }).catch((error) => { if (active) setDetailError(error.message); });
    return () => { active = false; };
  }, [selected?.id, selected?.lastCheckedAt, sites.length]);
  const activeIncidents = incidents.filter((incident) => incident.status === "OPEN");
  const monitoredCount = sites.filter((site) => site.monitoringEnabled).length;
  return <>
    <PageHeading eyebrow="SITE WATCH" title="A quiet watch on live pages." action={<Button kind="primary" onClick={() => setShowForm((show) => !show)}>{showForm ? "Close form" : "Add monitored page"}</Button>}>Configured pages are checked on the backend schedule. History and incidents below are actual recorded inspections.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Pages monitored" value={monitoredCount} note="The scheduler runs every 30 minutes" tone="green" />
      <Metric label="Active incidents" value={activeIncidents.length} note="Changes or availability issues needing review" tone={activeIncidents.length ? "coral" : ""} />
      <Metric label="Last monitoring run" value={data.dashboard?.lastMonitoringRun ? formatDate(data.dashboard.lastMonitoringRun) : "Not yet"} note="Latest recorded check across pages" />
    </div>
    {showForm && <section className="panel add-site-panel"><div><h2>Add a page</h2><p>The server validates public HTTP(S) destinations and blocks private or local network addresses.</p></div>
      <form className="site-form" onSubmit={createSite}><label>Page name<input name="name" required maxLength="120" placeholder="Product landing page" /></label><label>Public URL<input name="url" type="url" required maxLength="2048" placeholder="https://example.com/product" /></label><Button kind="primary" type="submit" disabled={busy === "add-site"}>{busy === "add-site" ? "Adding…" : "Add page"}</Button></form>
    </section>}
    <div className="watch-layout">
      <section className="panel sites-panel"><div className="panel-heading"><div><h2>Monitored pages</h2><p>{sites.length} configured destinations</p></div></div>
        {sites.length === 0 ? <Empty title="No pages added">Add a public landing page to start availability and change checks.</Empty> : <div className="site-list">{sites.map((site) => {
          const open = incidents.find((incident) => incident.siteId === site.id && incident.status === "OPEN");
          return <button key={site.id} className={`site-option ${selectedId === site.id ? "selected" : ""}`} onClick={() => setSelectedId(site.id)} aria-pressed={selectedId === site.id}>
            <span className={`watch-bullet ${open ? "alert" : site.monitoringEnabled ? "ok" : ""}`} aria-hidden="true" />
            <span className="site-option-main"><strong>{site.name}</strong><small>{site.url}</small></span><span className="site-option-state">{open ? "Incident" : site.monitoringEnabled ? "Monitoring" : "Paused"}</span>
          </button>;
        })}</div>}
      </section>
      <section className="panel site-detail-panel">
        {!selected ? <Empty title="Choose a page">Select a monitored destination to inspect its history.</Empty> : <>
          <div className="site-detail-head"><div><div className="eyebrow">MONITORED DESTINATION</div><h2>{selected.name}</h2><a href={selected.url} target="_blank" rel="noreferrer" className="destination-link">{selected.url} ↗</a></div><Status value={selected.monitoringEnabled ? details?.summary?.latestSnapshot?.status || "UNKNOWN" : "UNKNOWN"} label={!selected.monitoringEnabled ? "Paused" : details?.summary?.latestSnapshot?.status || "Waiting"} /></div>
          <div className="site-timing"><div><span>Last check</span><strong>{formatDate(selected.lastCheckedAt)}</strong></div><div><span>Next scheduled</span><strong>{selected.monitoringEnabled ? formatDate(selected.nextCheckAt) : "Monitoring paused"}</strong></div><div><span>Response time</span><strong>{details?.summary?.latestSnapshot?.responseTimeMs != null ? `${details.summary.latestSnapshot.responseTimeMs} ms` : "Not recorded yet"}</strong></div></div>
          <div className="site-actions"><Button kind="primary" disabled={!selected.monitoringEnabled || busy === `site:${selected.id}`} onClick={() => checkSite(selected.id, "Fresh page inspection completed.")}>{busy === `site:${selected.id}` ? "Checking…" : "Check now"}</Button><Button disabled={busy === `site-update:${selected.id}`} onClick={() => updateSite(selected, { monitoringEnabled: !selected.monitoringEnabled })}>{selected.monitoringEnabled ? "Pause monitoring" : "Resume monitoring"}</Button><Button className="destructive-text" onClick={() => archiveSite(selected)}>Archive page</Button></div>
          {detailError && <div className="alert error" role="alert">{detailError}</div>}
          {details && <><section className="history-section"><div className="section-heading"><h3>Check history</h3><span>{details.snapshots.length} recorded checks</span></div>
            {details.snapshots.length === 0 ? <Empty title="Waiting for the first check">The backend worker has not recorded an inspection for this page yet.</Empty> :
              <div className="history-list">{details.snapshots.map((snapshot) => <div key={snapshot.id} className="history-row"><span className={`history-mark ${statusTone(snapshot.status)}`} aria-hidden="true">{snapshot.status === "PASS" ? "✓" : "!"}</span><div className="history-copy"><strong>{snapshot.status} · HTTP {snapshot.httpStatus ?? "—"}{snapshot.responseTimeMs != null ? ` · ${snapshot.responseTimeMs} ms` : ""}</strong><small>{snapshot.errorCode || snapshot.finalUrl || snapshot.requestedUrl}</small></div><time dateTime={snapshot.capturedAt}>{formatDate(snapshot.capturedAt)}</time></div>)}</div>}
          </section><section className="history-section"><div className="section-heading"><h3>Incidents</h3><span>{details.incidents.length} total</span></div>
            {details.incidents.length === 0 ? <p className="muted-copy">No incidents have been recorded for this page.</p> : <div className="incident-list">{details.incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} actOnIncident={actOnIncident} busy={busy} />)}</div>}
          </section></>}
        </>}
      </section>
    </div>
  </>;
}

function IncidentCard({ incident, actOnIncident, busy }) {
  return <article className="incident-card"><div className="incident-card-head"><strong>{incident.title}</strong><Status value={incident.status} /></div><p>{incident.type} · {incident.severity || "severity not specified"}</p><div className="incident-values"><span>Before: {valueText(incident.oldValue?.value ?? incident.oldValue)}</span><span>Observed: {valueText(incident.newValue?.value ?? incident.newValue)}</span></div><div className="incident-foot"><span>Last seen {formatDate(incident.lastSeenAt)}{incident.resolvedAt ? ` · Resolved ${formatDate(incident.resolvedAt)}` : ""}</span>{incident.status === "OPEN" && <span className="incident-buttons"><Button disabled={busy === `incident:${incident.id}`} onClick={() => actOnIncident(incident, "recheck")}>Recheck</Button><Button disabled={busy === `incident:${incident.id}`} onClick={() => actOnIncident(incident, "resolve")}>Request resolution</Button><Button disabled={busy === `incident:${incident.id}`} onClick={() => actOnIncident(incident, "mark-intentional")}>Mark intentional</Button></span>}</div></article>;
}

function Settings({ data, busy, syncMeta, disconnectMeta, savePreferences }) {
  const { meta, sites, preferences } = data;
  const connected = meta.connection?.status === "CONNECTED";
  return <>
    <PageHeading eyebrow="SETTINGS" title="Keep your checks useful." >Manage the Meta connection, monitored destinations, and notification preferences.</PageHeading>
    <section className="panel settings-account"><div className="settings-title"><div><h2>Meta Ads account</h2><p>Read-only campaign access for QA. SteadySignal does not edit, pause, or publish ads.</p></div><span className="meta-letter" aria-hidden="true">M</span></div>
      <div className="settings-connection"><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? meta.connection.status || "Connected" : "Not connected"} />
        <div className="account-details">{meta.accounts?.length ? meta.accounts.map((account) => <span key={account.id}><strong>{account.name}</strong><small>{account.externalId} · {account.currency || "Currency unavailable"}</small></span>) : <span><strong>{connected ? "Account sync pending" : "No ad account connected"}</strong><small>{connected ? "Sync Meta Ads to load the account." : "Connect using Meta OAuth; tokens stay on the server."}</small></span>}</div>
        {meta.connection?.lastSyncAt && <small>Last sync {formatDate(meta.connection.lastSyncAt)}</small>}
      </div>
      <div className="settings-actions">{connected ? <><Button onClick={syncMeta} disabled={busy === "sync"}>{busy === "sync" ? "Syncing…" : "Sync now"}</Button><Button onClick={() => window.location.assign("/api/integrations/meta/connect")}>Reconnect</Button><Button className="destructive-text" onClick={disconnectMeta}>Disconnect</Button></> : <Button kind="primary" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}</div>
      {meta.connection?.lastError && <div className="alert error">{meta.connection.lastError}</div>}
    </section>
    <div className="settings-grid">
      <section className="panel settings-monitoring"><h2>Site monitoring</h2><p>Monitoring cadence is configured by the backend and fixed at 30 minutes.</p><div className="setting-line"><span>Check interval</span><strong>Every 30 minutes</strong></div><div className="setting-line"><span>Configured pages</span><strong>{sites.length} · {sites.filter((site) => site.monitoringEnabled).length} active</strong></div><a className="text-link" href="#/site-watch">Manage monitored pages →</a></section>
      <form className="panel settings-notifications" onSubmit={savePreferences}><h2>Notifications</h2><p>Emails are queued only when SMTP delivery is enabled by the workspace backend.</p>
        <label className="form-label">Notification email<input type="email" name="email" required maxLength="254" defaultValue={preferences.email} /></label>
        <label className="toggle-row"><span><strong>New incidents</strong><small>When a monitored page changes or fails.</small></span><input type="checkbox" name="incidentAlertsEnabled" defaultChecked={preferences.incidentAlertsEnabled} aria-label="Email me about new incidents" /></label>
        <label className="toggle-row"><span><strong>Recovery updates</strong><small>When a new check verifies recovery.</small></span><input type="checkbox" name="recoveryAlertsEnabled" defaultChecked={preferences.recoveryAlertsEnabled} aria-label="Email me about recovery updates" /></label>
        <Button kind="primary" type="submit" disabled={busy === "preferences"}>{busy === "preferences" ? "Saving…" : "Save preferences"}</Button>
      </form>
    </div>
    <p className="security-note">Meta tokens remain encrypted on the server. The frontend uses an HttpOnly session cookie and never reads credentials or tokens.</p>
  </>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
