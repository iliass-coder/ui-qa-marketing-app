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
    const [me, dashboard, meta, campaigns, incidents, preferences] = await Promise.all([
      request("/api/me"),
      request("/api/dashboard"),
      request("/api/integrations/meta/status"),
      request("/api/campaigns"),
      request("/api/incidents"),
      request("/api/notification-preferences")
    ]);
    setUser(me);
    setData({ dashboard, meta, campaigns, incidents, preferences });
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

  const monitorCampaign = async (campaignId, enable) => {
    setBusy(`monitor:${campaignId}`);
    setLoadError("");
    try {
      if (enable) {
        const job = await request(`/api/campaigns/${campaignId}/monitor`, { method: "POST" });
        const complete = await waitFor("/api/jobs", job.id);
        if (complete.status === "FAILED") throw new Error(complete.errorMessage || "The campaign check failed.");
      } else {
        await request(`/api/campaigns/${campaignId}/monitor`, { method: "DELETE" });
      }
      await reload();
      setToast(enable ? "Campaign monitoring is on. Destinations refresh from Meta before every check." : "Campaign monitoring is paused.");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const checkCampaign = async (campaignId) => {
    setBusy(`campaign-monitor:${campaignId}`);
    setLoadError("");
    try {
      const job = await request(`/api/campaigns/${campaignId}/monitor/check-now`, { method: "POST" });
      const complete = await waitFor("/api/jobs", job.id);
      if (complete.status === "FAILED") throw new Error(complete.errorMessage || "The campaign check failed.");
      await reload();
      setToast("Campaign refreshed from Meta and its current destinations were checked.");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setBusy("");
    }
  };

  const saveMetaAccounts = async (accountIds) => {
    setBusy("meta-accounts");
    setLoadError("");
    try {
      const job = await request("/api/integrations/meta/accounts", {
        method: "PUT",
        body: { accountIds }
      });
      const complete = await waitFor("/api/jobs", job.id);
      if (complete.status === "FAILED") throw new Error(complete.errorMessage || "Meta account sync failed.");
      await reload();
      setToast("Selected ad accounts and campaigns are up to date.");
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
        <NavItem id="site-watch" active={activeNav === "site-watch"} icon="◉" label="Campaign watch" />
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
        <div className="breadcrumbs"><span>{user?.workspace?.name || "Workspace"}</span><span aria-hidden="true">/</span><strong>{route.page === "report" ? "QA report" : route.page === "site-watch" ? "Campaign watch" : route.page[0].toUpperCase() + route.page.slice(1)}</strong></div>
        <div className="topbar-right"><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? "Meta Ads connected" : "Meta disconnected"} /><span className="topbar-user">{user?.user?.name || user?.user?.email}</span></div>
      </header>
      <div className="page-content">
        {!connected && <div className="alert connection-alert" role="status"><div><strong>Meta account disconnected</strong><span>Connect Meta to import real campaigns and run prelaunch QA.</span></div><Button kind="primary" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button></div>}
        {connection?.lastError && <div className="alert error" role="alert">Meta reports: {connection.lastError}. Reconnect or review the account configuration.</div>}
        {metaSyncIsStale && <div className="alert stale-alert" role="status">Meta campaign data was last synced {formatDate(connection.lastSyncAt)}. Sync now before relying on campaign status.</div>}
        {loadError && <div className="alert error" role="alert"><span>{loadError}</span><button className="alert-close" aria-label="Dismiss error" onClick={() => setLoadError("")}>×</button></div>}
        {route.page === "overview" && <Overview data={data} busy={busy} runQa={runQa} syncMeta={syncMeta} />}
        {route.page === "campaigns" && <Campaigns data={data} busy={busy} runQa={runQa} monitorCampaign={monitorCampaign} syncMeta={syncMeta} selectMetaAccounts={saveMetaAccounts} />}
        {route.page === "report" && <QaReport campaignId={route.id} refreshKey={data.campaigns?.find((item) => item.campaign?.id === route.id)?.lastQa?.id || ""} runQa={runQa} busy={busy} />}
        {route.page === "site-watch" && <SiteWatch data={data} busy={busy} checkCampaign={checkCampaign} monitorCampaign={monitorCampaign} actOnIncident={actOnIncident} />}
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
  const { campaigns = [], incidents = [], dashboard = {}, meta = {} } = data;
  const needsReview = campaigns.filter((item) => {
    const status = item.qaState || item.verdict;
    const campaign = item.campaign || {};
    return campaignPhase(campaign) !== "Live" && (!item.lastQa || ["FAIL", "WARNING", "STALE", "UNKNOWN"].includes(status));
  });
  const monitored = campaigns.filter((item) => item.monitoringEnabled);
  const openIncidents = incidents.filter((incident) => incident.status === "OPEN");
  const recent = [...campaigns].sort((a, b) => new Date(b.campaign?.updatedAt || 0) - new Date(a.campaign?.updatedAt || 0)).slice(0, 4);
  return <>
    <PageHeading eyebrow="WORKSPACE OVERVIEW" title="A steadier read on your campaigns." action={!meta.connection && <Button kind="primary" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}>Catch campaign and landing-page mismatches before launch, then keep watch on pages already live.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Imported campaigns" value={dashboard.importedCampaigns ?? campaigns.length} note={meta.accounts?.length ? `Across ${meta.accounts.length} connected ad account${meta.accounts.length === 1 ? "" : "s"}` : "From your connected Meta account"} />
      <Metric label="Need a closer look" value={needsReview.length} note={openIncidents.length ? `${openIncidents.length} active campaign incident${openIncidents.length === 1 ? "" : "s"}` : "Prelaunch findings and stale checks"} tone={needsReview.length ? "coral" : ""} />
      <Metric label="Campaigns monitored" value={`${dashboard.monitoredCampaigns ?? monitored.length}`} note="Current Meta destinations checked every 30 minutes" tone="green" />
    </div>
    <div className="overview-grid">
      <section className="panel campaign-queue">
        <div className="panel-heading"><div><h2>Before the next dollar goes out</h2><p>Review upcoming campaigns and their latest real QA state.</p></div><Button onClick={() => navigate("campaigns")}>All campaigns</Button></div>
        {needsReview.length === 0 ? <Empty title={campaigns.length ? "No prelaunch campaign needs attention" : "No imported campaigns yet"}>{campaigns.length ? "Your backend reports no unchecked or non-passing campaigns." : meta.connection ? "Sync Meta Ads to import campaigns visible to the connected account." : "Connect a Meta Ads account to get started."}</Empty> :
          <div className="campaign-list">{needsReview.slice(0, 5).map((item) => <CampaignRow key={item.campaign.id} item={item} busy={busy} runQa={runQa} />)}</div>}
      </section>
      <section className="panel watch-summary">
        <div className="panel-heading compact"><div><h2>Campaign watch</h2><p>30-minute monitoring schedule</p></div><a className="text-link" href="#/site-watch">Open watch</a></div>
        {monitored.length === 0 ? <Empty title="No monitored campaigns">Use Monitor campaign in the Campaigns list to start a watch.</Empty> :
          <div className="watch-list">{monitored.slice(0, 4).map((item) => <CampaignWatchSummary key={item.campaign.id} item={item} incident={openIncidents.find((entry) => entry.campaignId === item.campaign.id)} />)}</div>}
        <div className="watch-footer"><span>Next scheduled check</span><strong>{formatDate(monitored.map((item) => item.nextMonitoringAt).filter(Boolean).sort()[0])}</strong></div>
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

function CampaignWatchSummary({ item, incident }) {
  const campaign = item.campaign;
  return <a className="watch-item" href="#/site-watch"><span className={"watch-bullet " + (incident ? "alert" : "ok")} aria-hidden="true" /><span className="watch-item-copy"><strong>{campaign.name}</strong><small>{incident ? incident.title : item.lastMonitoringAt ? "Last checked " + formatDate(item.lastMonitoringAt) : item.monitoringDestinationCount + " current destination" + (item.monitoringDestinationCount === 1 ? "" : "s")}</small></span><Status value={incident ? "OPEN" : item.lastMonitoringAt ? "PASS" : "UNKNOWN"} label={incident ? "Incident" : item.lastMonitoringAt ? "Monitoring" : "Waiting"} /></a>;
}

function Campaigns({ data, busy, runQa, monitorCampaign, syncMeta, selectMetaAccounts }) {
  const { campaigns = [], meta = {} } = data;
  const [filter, setFilter] = useState("All campaigns");
  const accounts = meta.accounts || [];
  const selectedAccounts = accounts.filter((account) => account.selected);
  const [accountFilter, setAccountFilter] = useState("");
  useEffect(() => {
    if (selectedAccounts.length === accounts.length && accounts.length > 1) setAccountFilter("__all__");
    else setAccountFilter(selectedAccounts[0]?.externalId || "");
  }, [meta.accounts]);
  const activeAccount = accounts.find((account) => account.externalId === accountFilter);
  const accountCampaigns = accountFilter === "__all__"
    ? campaigns
    : activeAccount
      ? campaigns.filter((item) => item.campaign?.adAccountId === activeAccount.id)
      : [];
  const rows = accountCampaigns.filter((item) => {
    const phase = campaignPhase(item.campaign);
    if (filter === "Before launch") return phase !== "Live";
    if (filter === "Live") return phase === "Live";
    return true;
  });
  const nonLive = accountCampaigns.filter((item) => campaignPhase(item.campaign) !== "Live");
  const needsAttention = nonLive.filter((item) => ["FAIL", "WARNING", "STALE"].includes(item.verdict)).length;
  const changeAccount = (event) => {
    const value = event.target.value;
    setAccountFilter(value);
    selectMetaAccounts(value === "__all__" ? accounts.map((account) => account.externalId) : value ? [value] : []);
  };
  return <>
    <PageHeading eyebrow="CAMPAIGN ASSURANCE" title="Campaigns to review." action={<div className="campaign-heading-actions">{accounts.length > 0 && <label className="account-filter-label">Ad account<select value={accountFilter} onChange={changeAccount} disabled={busy === "sync" || busy === "meta-accounts"}>
      <option value="">Select an ad account</option>
      {accounts.length > 1 && <option value="__all__">All ad accounts</option>}
      {accounts.map((account) => <option key={account.id} value={account.externalId}>{account.name} ({account.externalId.replace(/^act_/, "")})</option>)}
    </select></label>}<Button onClick={syncMeta} disabled={!meta.connection || busy === "sync" || busy === "meta-accounts"}>{busy === "sync" ? "Syncing…" : "Sync Meta Ads"}</Button></div>}>Check the offer, destination, and tracking before a campaign goes live. Status and findings come from the selected ad account.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Needs attention" value={needsAttention} note="Latest backend QA verdicts" tone={needsAttention ? "coral" : ""} />
      <Metric label="Before launch" value={nonLive.length} note="Draft, paused, or scheduled Meta campaigns" />
      <Metric label="Currently live" value={campaigns.length - nonLive.length} note="Active status from Meta" tone="green" />
    </div>
    <section className="panel table-panel">
      <div className="panel-heading"><div><h2>Campaign queue</h2><p>Monitor campaign destinations every 30 minutes, run QA, or inspect a saved report.</p></div></div>
      <div className="filter-tabs" role="group" aria-label="Filter campaigns">{["All campaigns", "Before launch", "Live"].map((name) => <button key={name} className={`filter-tab ${filter === name ? "selected" : ""}`} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}</button>)}</div>
      {busy === "meta-accounts" ? <div className="center-state inline campaign-loading" role="status" aria-live="polite"><div className="spinner" aria-hidden="true" /><p>Loading campaigns for the selected ad account…</p></div> : rows.length ? <CampaignTable items={rows} busy={busy} runQa={runQa} monitorCampaign={monitorCampaign} /> : <Empty title={accountCampaigns.length ? "No campaigns in this view" : "No campaign data yet"}>{accountCampaigns.length ? "Choose another campaign filter." : meta.connection ? (accounts.length && !accountFilter ? "Choose an ad account from the dropdown to sync and display its campaigns." : "No campaigns were returned for this ad account. Try syncing again or choose another account.") : "Connect Meta Ads to import real campaigns."}</Empty>}
    </section>
  </>;
}

function CampaignTable({ items, busy, runQa, monitorCampaign }) {
  return <div className="table-wrap"><table className="data-table">
    <thead><tr><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col">Launch</th><th scope="col">Latest QA</th>{monitorCampaign && <th scope="col">Campaign monitoring</th>}<th scope="col"><span className="sr-only">Action</span></th></tr></thead>
    <tbody>{items.map((item) => {
      const campaign = item.campaign;
      const phase = campaignPhase(campaign);
      const status = item.qaState || "Not checked";
      return <tr key={campaign.id}>
        <td><div className="table-campaign"><span className="campaign-initial small" aria-hidden="true">{(campaign.name || "C").slice(0, 1).toUpperCase()}</span><span><a className="campaign-title" href={`#/report/${campaign.id}`}>{campaign.name}</a><small>{campaign.objective || "Meta Ads"} · {item.adSetCount ?? 0} ad sets · {item.adCount ?? 0} ads</small></span></div></td>
        <td><Status value={phase === "Live" ? "ACTIVE" : "UNKNOWN"} label={phase} /></td>
        <td>{formatDate(campaign.startAt, { dateStyle: "medium", timeStyle: undefined })}</td>
        <td><Status value={item.verdict || "UNKNOWN"} label={status} /></td>
        {monitorCampaign && <td><Button disabled={busy === "monitor:" + campaign.id || (!item.monitoringEnabled && !item.monitoringAvailable)} onClick={() => monitorCampaign(campaign.id, !item.monitoringEnabled)} title={!item.monitoringEnabled && !item.monitoringAvailable ? "No ad destination is currently available. Sync this campaign from Meta first." : undefined}>{busy === "monitor:" + campaign.id ? "Updating..." : item.monitoringEnabled ? "Pause watch" : item.monitoringAvailable ? "Monitor campaign (" + item.monitoringDestinationCount + " destination" + (item.monitoringDestinationCount === 1 ? "" : "s") + ")" : "No destination"}</Button></td>}
        <td className="action-cell">{item.lastQa && !["STALE", "Not checked"].includes(status) ? <Button onClick={() => navigate(`report/${campaign.id}`)}>View report</Button> : <Button kind="primary" disabled={busy === `qa:${campaign.id}`} onClick={() => runQa(campaign.id)}>{busy === `qa:${campaign.id}` ? "Checking…" : "Run QA"}</Button>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function formatMetaBudget(value, currency) {
  if (value == null || value === "") return "Not set";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency || ""}`.trim();
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: "currency", currency });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(amount / (10 ** fractionDigits));
  } catch {
    return `${value} ${currency || ""}`.trim();
  }
}

function targetingSummary(targeting = {}) {
  const geo = targeting.geo_locations || {};
  const locations = [
    ...(geo.countries || []),
    ...(geo.regions || []).map((item) => item.name || item.key).filter(Boolean),
    ...(geo.cities || []).map((item) => item.name || item.key).filter(Boolean)
  ];
  const age = targeting.age_min || targeting.age_max
    ? `${targeting.age_min ?? "?"}–${targeting.age_max ?? "?"}`
    : "Default age range";
  const genders = (targeting.genders || []).map((gender) => ({ 1: "men", 2: "women" })[gender] || String(gender));
  const platforms = targeting.publisher_platforms || [];
  return [
    `Ages ${age}`,
    locations.length ? `Locations: ${locations.slice(0, 5).join(", ")}${locations.length > 5 ? ` +${locations.length - 5}` : ""}` : "Location targeting unavailable",
    genders.length ? `Gender: ${genders.join(", ")}` : "All genders",
    platforms.length ? `Placements: ${platforms.join(", ")}` : "Automatic placements"
  ].join(" · ");
}

function humanizeLabel(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function targetingDetails(targeting = {}) {
  const geo = targeting.geo_locations || {};
  const names = (items = []) => items.map((item) => typeof item === "string" ? item : item.name || item.key || item.id).filter(Boolean);
  const included = [
    ...names(geo.countries), ...names(geo.regions), ...names(geo.cities), ...names(geo.zips)
  ];
  const excluded = [
    ...names(geo.excluded_countries), ...names(geo.excluded_regions),
    ...names(geo.excluded_cities), ...names(geo.excluded_zips)
  ];
  const age = targeting.age_min || targeting.age_max
    ? `${targeting.age_min ?? "?"}–${targeting.age_max ?? "?"} years`
    : "Meta default age range";
  const genders = (targeting.genders || []).map((gender) => ({ 1: "Men", 2: "Women" })[gender] || String(gender));
  const platforms = targeting.publisher_platforms || [];
  const positionKeys = ["facebook_positions", "instagram_positions", "messenger_positions", "audience_network_positions", "threads_positions"];
  const positions = positionKeys.flatMap((key) => (targeting[key] || []).map((position) => `${humanizeLabel(key.replace("_positions", ""))}: ${humanizeLabel(position)}`));
  const languages = names(targeting.locales || targeting.languages);
  return [
    { label: "Included locations", value: included.length ? included.join(", ") : "No location restriction provided" },
    { label: "Excluded locations", value: excluded.length ? excluded.join(", ") : "None specified" },
    { label: "Age range", value: age },
    { label: "Audience", value: genders.length ? genders.join(", ") : "All genders" },
    { label: "Placements", value: platforms.length ? `${platforms.map(humanizeLabel).join(", ")}${positions.length ? ` · ${positions.join(", ")}` : ""}` : "Automatic placements" },
    ...(languages.length ? [{ label: "Languages", value: languages.join(", ") }] : []),
    ...(targeting.device_platforms?.length ? [{ label: "Devices", value: targeting.device_platforms.map(humanizeLabel).join(", ") }] : [])
  ];
}

function AdCreativeCard({ ad }) {
  const destination = safeExternalUrl(ad.destinationUrl);
  const rawCallToAction = ad.rawDataJson?.gatekeeper_cta || ad.rawDataJson?.creative?.call_to_action_type;
  const callToAction = rawCallToAction && rawCallToAction !== "UNKNOWN" ? humanizeLabel(rawCallToAction) : "";
  return <article className="creative-copy">
    <div className="ad-creative-heading"><div><div className="creative-type">AD · {ad.name || "Ad creative"}</div><small>{ad.effectiveStatus || ad.status || "Status unavailable"}{callToAction ? ` · CTA: ${callToAction}` : ""}</small></div></div>
    {ad.headline && <h3>{ad.headline}</h3>}
    <p>{ad.primaryText || "Primary text not available from Meta."}</p>
    {ad.description && <p className="muted-copy">{ad.description}</p>}
    {destination && <a href={destination} target="_blank" rel="noreferrer" className="destination-link">{destination}</a>}
  </article>;
}

function AdSetCard({ adSet, ads }) {
  const audience = targetingDetails(adSet.targetingJson);
  const budget = adSet.dailyBudget
    ? `Daily ${formatMetaBudget(adSet.dailyBudget, adSet.currency)}`
    : adSet.lifetimeBudget
      ? `Lifetime ${formatMetaBudget(adSet.lifetimeBudget, adSet.currency)}`
      : "Budget not set at ad set level";
  const bid = adSet.bidAmount ? ` · Bid ${formatMetaBudget(adSet.bidAmount, adSet.currency)}` : "";
  const schedule = `${adSet.startAt ? formatDate(adSet.startAt) : "No start date"} – ${adSet.endAt ? formatDate(adSet.endAt) : "No end date"}`;
  return <article className="adset-review">
    <div className="adset-heading"><div><div className="creative-type">AD SET</div><h3>{adSet.name || "Unnamed ad set"}</h3></div><Status value={adSet.effectiveStatus || adSet.status || "UNKNOWN"} /></div>
    <div className="adset-facts">
      <div><span>Optimization</span><strong>{adSet.optimizationGoal || "Not provided"}</strong></div>
      <div><span>Budget</span><strong>{budget}</strong></div>
      <div><span>Billing / bid</span><strong>{adSet.billingEvent || "Not provided"}{adSet.bidStrategy ? ` · ${adSet.bidStrategy}` : ""}{bid}</strong></div>
      <div><span>Schedule</span><strong>{schedule}</strong></div>
    </div>
    <div className="audience-details" aria-label="Audience and delivery settings">{audience.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div>
    {adSet.promotedObjectJson && Object.keys(adSet.promotedObjectJson).length > 0 && <details className="targeting-details"><summary>Conversion details</summary><dl className="structured-details">{Object.entries(adSet.promotedObjectJson).filter(([, value]) => value != null && value !== "").map(([key, value]) => <div key={key}><dt>{humanizeLabel(key)}</dt><dd>{Array.isArray(value) ? value.join(", ") : typeof value === "object" ? Object.values(value).filter((item) => typeof item !== "object").join(" · ") : String(value)}</dd></div>)}</dl></details>}
    <div className="adset-creatives">
      {ads.length ? ads.map((ad) => <AdCreativeCard key={ad.id} ad={ad} />) : <p className="muted-copy">No ads were returned for this ad set.</p>}
    </div>
  </article>;
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
      request(`/api/campaigns/${campaignId}/ads`),
      request(`/api/campaigns/${campaignId}/adsets`)
    ]).then(async ([summary, ads, adSets]) => {
      const run = summary.lastQa;
      if (!run) {
        if (active) setDetail({ summary, ads, adSets, run: null, results: [], evidence: {} });
        return;
      }
      if (["QUEUED", "RUNNING"].includes(run.status)) {
        if (active) setDetail({ summary, ads, adSets, run, results: [], evidence: {} });
        waitFor("/api/qa-runs", run.id)
          .then(() => { if (active) setReportVersion((version) => version + 1); })
          .catch((e) => { if (active) setError(e.message); });
        return;
      }
      const report = await request(`/api/qa-runs/${run.id}/report`);
      if (active) setDetail({ summary, ads, adSets, run, results: report.results, evidence: report.evidence });
    }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [campaignId, refreshKey, reportVersion]);

  if (loading) return <div className="center-state inline"><div className="spinner" /><p>Loading the latest QA report…</p></div>;
  if (error) return <div className="alert error" role="alert">{error} <Button onClick={() => window.location.reload()}>Retry</Button></div>;
  if (!detail) return null;
  const campaign = detail.summary.campaign;
  const adSets = detail.adSets || [];
  const ads = detail.ads || [];
  const assignedAdIds = new Set(adSets.flatMap((adSet) => ads.filter((ad) => ad.adSetId === adSet.id).map((ad) => ad.id)));
  const unassignedAds = ads.filter((ad) => !assignedAdIds.has(ad.id));
  const results = detail.results || [];
  const reportTypes = new Set(["budget", "availability", "product_consistency", "market_language", "offer_eligibility", "service_region", "copy_quality"]);
  const coreResults = results
    .filter((result) => reportTypes.has(result.checkType))
    .sort((a, b) => severityOrder(a.severity, a.status) - severityOrder(b.severity, b.status));
  const actionCount = coreResults.filter((result) => ["FAIL", "WARNING", "STALE"].includes(result.status)).length;
  const reviewCount = coreResults.filter((result) => result.status === "UNKNOWN").length;
  const passedCount = coreResults.filter((result) => result.status === "PASS").length;
  return <>
    <PageHeading eyebrow="CAMPAIGN REVIEW" title="Campaign QA report" action={<Button onClick={() => navigate("campaigns")}>← All campaigns</Button>}>
      Review what needs attention, what passed, and the campaign details behind each check.
    </PageHeading>
    <div className={`report-summary ${statusTone(detail.summary.verdict || "UNKNOWN")}`}>
      <div className="report-verdict"><div className="eyebrow">CAMPAIGN READINESS</div><Status value={detail.summary.verdict || "UNKNOWN"} label={friendlyStatus(detail.summary.verdict)} /><small>Based on the latest QA run</small></div>
      <div className="report-count"><strong>{actionCount}</strong><span>Need action</span></div>
      <div className="report-count"><strong>{reviewCount}</strong><span>Need your review</span></div>
      <div className="report-count"><strong>{passedCount}</strong><span>Checks passed</span></div>
      <div className="report-last-run"><span>Last checked</span><strong>{formatDate(detail.run?.completedAt || detail.run?.createdAt)}</strong></div>
      <Button kind="primary" disabled={busy === `qa:${campaignId}`} onClick={() => runQa(campaignId)}>{busy === `qa:${campaignId}` ? "Running QA…" : detail.run ? "Check again" : "Run campaign check"}</Button>
    </div>
    {detail.run && ["QUEUED", "RUNNING"].includes(detail.run.status) && <div className="alert" role="status">A QA run is {detail.run.status.toLowerCase()}. Refresh this report in a moment to see its result.</div>}
    {detail.run?.status === "FAILED" && <div className="alert error" role="alert">{detail.run.errorMessage || "The latest QA run failed."}</div>}
    <div className="report-columns">
      <section className="panel creative-panel"><div className="campaign-info-heading"><div><div className="eyebrow">CAMPAIGN OVERVIEW</div><h2>{campaign.name}</h2><p>{campaign.objective || "Objective not provided"}</p></div><Status value={campaignPhase(campaign) === "Live" ? "ACTIVE" : campaign.status || "UNKNOWN"} label={campaignPhase(campaign)} /></div>
        <div className="campaign-count-strip"><span>{adSets.length} ad sets</span><span>{ads.length} ads</span><span>Meta status: {humanizeLabel(campaign.status || "Not reported")}</span></div>
        <div className="campaign-facts">
          <div><span>Campaign budget</span><strong>{campaign.dailyBudget ? `${formatMetaBudget(campaign.dailyBudget, campaign.currency)} per day` : campaign.lifetimeBudget ? `${formatMetaBudget(campaign.lifetimeBudget, campaign.currency)} lifetime` : "Set across ad sets"}</strong></div>
          <div><span>Campaign schedule</span><strong>{campaign.startAt ? formatDate(campaign.startAt, { dateStyle: "medium", timeStyle: undefined }) : "No start date"} – {campaign.endAt ? formatDate(campaign.endAt, { dateStyle: "medium", timeStyle: undefined }) : "No end date"}</strong></div>
        </div>
        {adSets.length === 0 ? <Empty title="Ad set details are not available yet">Sync this ad account to import its ad sets and targeting settings.</Empty> : adSets.map((adSet) => <AdSetCard key={adSet.id} adSet={adSet} ads={ads.filter((ad) => ad.adSetId === adSet.id)} />)}
        {unassignedAds.length > 0 && <section className="unassigned-ads"><h3>Ads without ad set details</h3>{unassignedAds.map((ad) => <AdCreativeCard key={ad.id} ad={ad} />)}</section>}
        {ads.length === 0 && adSets.length > 0 && <p className="muted-copy">No ads were returned for this campaign.</p>}
      </section>
      <section className="panel finding-panel"><div className="panel-heading"><div><h2>Launch checklist</h2><p>{actionCount ? `${actionCount} item${actionCount === 1 ? "" : "s"} to address` : "No blocking issues found"}{reviewCount ? ` · ${reviewCount} need your judgment` : ""}</p></div><small className="report-check-count">{coreResults.length} checks</small></div>
        {!detail.run ? <Empty title="No QA run yet">Campaign and ad details are ready to review. Run QA when you want the backend to inspect the current ads and destinations.</Empty> : ["QUEUED", "RUNNING"].includes(detail.run.status) ? <Empty title="QA is running">The ad hierarchy is available while the backend finishes checking the ads and destinations.</Empty> : coreResults.length === 0 ? <Empty title="No core checks returned">The latest run has no results for the selected launch checks.</Empty> : <div className="finding-list">{coreResults.map((result) => <Finding key={result.id} result={result} evidence={detail.evidence[result.id] || []} />)}</div>}
      </section>
    </div>
  </>;
}

function friendlyStatus(status) {
  return ({ PASS: "Looks good", FAIL: "Needs action", WARNING: "Review this", UNKNOWN: "Could not confirm", STALE: "Check is out of date" })[String(status || "").toUpperCase()] || "Not checked";
}

function findingMeta(result) {
  if (result.status === "PASS") return "Check passed";
  const severity = String(result.severity || "").toLowerCase();
  if (severity === "critical") return "High impact if unresolved";
  if (severity === "major" && ["FAIL", "WARNING"].includes(result.status)) return "Review before launch";
  if (severity === "minor") return "Copy improvement";
  return "Needs your review";
}

function parseReportValue(raw) {
  let value = raw?.value ?? raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return value; }
  }
  return value;
}

function reportValueLines(result, side) {
  const value = parseReportValue(side === "expected" ? result.expectedJson : result.observedJson);
  if (value == null || value === "") return ["No detail recorded"];
  if (typeof value !== "object") return [String(value)];
  const type = result.checkType;
  if (type === "budget" && side === "observed") {
    const lines = [];
    const total = Number(value.knownDailyTotalUsd);
    if (Number.isFinite(total)) lines.push(`Combined daily budget: ${formatMetaBudget(total * 100, "USD")}`);
    for (const allocation of value.allocations || []) {
      const currency = allocation.currency || "USD";
      const amount = allocation.amountUsd != null
        ? formatMetaBudget(Number(allocation.amountUsd) * 100, "USD")
        : allocation.rawMinorUnits != null
          ? formatMetaBudget(allocation.rawMinorUnits, currency)
          : "Amount not provided";
      lines.push(`${humanizeLabel(allocation.level || "budget")} budget: ${amount} per day`);
    }
    if (lines.length) return lines;
  }
  if (type === "availability" && side === "observed") {
    const lines = [];
    if (value.httpStatus != null) lines.push(`Page response: HTTP ${value.httpStatus}`);
    if (value.snapshotStatus) lines.push(`Content check: ${value.snapshotStatus === "PASS" ? "Readable page content found" : humanizeLabel(value.snapshotStatus)}`);
    if (value.visibleTextLength != null) lines.push(`${Number(value.visibleTextLength).toLocaleString()} characters of page text captured`);
    if (value.error) lines.push(`Page check detail: ${value.error}`);
    if (lines.length) return lines;
  }
  if (["product_consistency", "market_language", "offer_eligibility", "service_region"].includes(type)) {
    if (side === "expected") {
      const lines = [];
      if (value.campaign) lines.push(`Campaign: ${value.campaign}`);
      if (value.check) lines.push(value.check);
      const targets = Array.isArray(value.targetLocations) ? value.targetLocations : value.targetLocations ? [value.targetLocations] : [];
      if (targets.length) lines.push(`Target locations: ${targets.join(", ")}`);
      if (value.adCopy) lines.push(`Ad message: ${String(value.adCopy).replace(/\s+/g, " ").slice(0, 180)}${String(value.adCopy).length > 180 ? "…" : ""}`);
      if (lines.length) return lines;
    } else if (value.pageTitle) {
      return [`Landing page: ${value.pageTitle}`];
    }
  }
  return Object.entries(value)
    .filter(([key, item]) => !["pageEvidence", "adCopy", "issues"].includes(key) && item != null && item !== "")
    .map(([key, item]) => `${humanizeLabel(key)}: ${Array.isArray(item) ? item.join(", ") : typeof item === "object" ? Object.values(item).filter((part) => typeof part !== "object").join(" · ") : String(item)}`)
    .slice(0, 5);
}

function reviewExplanation(result) {
  const message = result.humanMessage || "No explanation was provided for this check.";
  if (message.startsWith("AI_UNSUPPORTED_EVIDENCE:")) return "The AI described a possible result, but its quoted text did not match the captured campaign or page. Review the source details before launch.";
  if (message.startsWith("TARGET_LOCATION_EVIDENCE_UNAVAILABLE:")) return "The campaign's target locations were not clear in the imported campaign data, so this check could not be confirmed.";
  if (/^AI_(UNAVAILABLE|INVALID|EMPTY|RESPONSE)/.test(message)) return "The automated review could not complete this check. Run the campaign check again.";
  return message;
}

function severityOrder(severity, status) {
  const rank = { critical: 0, major: 1, moderate: 2, minor: 3 };
  return (rank[String(severity || "").toLowerCase()] ?? 4) * 10 + (status === "FAIL" ? 0 : status === "WARNING" ? 1 : 2);
}

function nextStep(result) {
  const type = String(result.checkType || "").toLowerCase();
  if (type.includes("budget")) return "Keep combined daily campaign and ad set budgets at or below $100 USD, or adjust the limit before launch.";
  if (type.includes("availability") || type.includes("destination") || type.includes("http")) return "Open the destination and confirm it loads before launch.";
  if (type.includes("copy_quality")) return "Correct the flagged spelling or grammar issues, then rerun QA.";
  if (type.includes("offer")) return "Confirm the offer applies and delivery or service is available in every targeted location.";
  if (type.includes("service_region")) return "Confirm delivery or service is available in every targeted location.";
  if (type.includes("market_language")) return "Use a landing page language your target audience can understand, or confirm the current language is suitable for that market.";
  if (type.includes("claim") || type.includes("product") || type.includes("semantic")) return "Compare the product in the ad with the product shown on the landing page before launch.";
  return "Review the evidence and rerun QA after making any changes.";
}

function Finding({ result, evidence }) {
  const [expanded, setExpanded] = useState(result.status !== "PASS");
  const analysis = parseReportValue(result.aiAnalysisJson) || {};
  const hasCombinedLocationEvidence = Object.hasOwn(analysis, "offer_page_evidence");
  const label = ({
    budget: "Daily budget · $100 USD limit",
    availability: "Landing page is up",
    product_consistency: "Product matches campaign",
    market_language: "Language fits targeted locations",
    offer_eligibility: hasCombinedLocationEvidence ? "Offer and delivery availability by location" : "Offer eligibility by location",
    service_region: "Delivery or service region",
    copy_quality: "Spelling and grammar · Ad copy"
  })[result.checkType] || result.checkType?.replaceAll("_", " ") || "Campaign check";
  const firstEvidence = evidence[0];
  const copyIssues = result.checkType === "copy_quality" ? parseReportValue(result.observedJson)?.issues || [] : [];
  const campaignQuote = analysis.source_evidence || analysis.sourceEvidence || "";
  const pageQuote = analysis.page_evidence || analysis.pageEvidence || "";
  const showCapturedText = result.checkType !== "budget" && firstEvidence?.excerpt;
  const capturedTextLabel = firstEvidence?.evidenceType === "HTML_AND_META_FIELDS"
    ? "View captured landing-page text"
    : result.checkType === "copy_quality" ? "View ad copy checked" : "View imported campaign details";
  return <article className={`finding ${statusTone(result.status)}`}>
    <button className="finding-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
      <span className={`finding-icon ${statusTone(result.status)}`} aria-hidden="true">{result.status === "PASS" ? "✓" : result.status === "FAIL" ? "!" : "·"}</span>
      <span className="finding-heading"><strong>{label}</strong><small>{findingMeta(result)}</small></span>
      <Status value={result.status} label={friendlyStatus(result.status)} /><span className="expand-caret" aria-hidden="true">{expanded ? "−" : "+"}</span>
    </button>
    {expanded && <div className="finding-detail">
      <p className="finding-explanation">{reviewExplanation(result)}</p>
      {result.checkType !== "copy_quality" && <div className="evidence-grid"><div><span>What this check looks for</span><ul>{reportValueLines(result, "expected").map((line, index) => <li key={index}>{line}</li>)}</ul></div><div><span>What we found</span><ul>{reportValueLines(result, "observed").map((line, index) => <li key={index}>{line}</li>)}</ul></div></div>}
      {copyIssues.length > 0 && <ul className="copy-quality-issues">{copyIssues.map((issue, index) => <li key={`${issue.field}-${index}`}><strong>{issue.field === "headline" ? "Headline" : "Primary text"}</strong><p><del>{issue.original_text}</del> <span aria-hidden="true">→</span> <ins>{issue.correction}</ins></p><small>{issue.explanation}</small></li>)}</ul>}
      {(campaignQuote || pageQuote) && <div className="quoted-evidence">{campaignQuote && <blockquote><span>From your campaign</span><p>{campaignQuote}</p></blockquote>}{hasCombinedLocationEvidence ? <blockquote><span>Offer and delivery evidence from the landing page</span><p>{analysis.offer_page_evidence && <>Offer terms: {analysis.offer_page_evidence}<br /></>}{analysis.service_page_evidence && <>Delivery or service: {analysis.service_page_evidence}</>}</p></blockquote> : pageQuote && <blockquote><span>From the landing page</span><p>{pageQuote}</p></blockquote>}</div>}
      {showCapturedText && <details className="captured-evidence"><summary>{capturedTextLabel}</summary><blockquote><span>{firstEvidence.source || firstEvidence.evidenceType || "Source details"}</span><p>{firstEvidence.excerpt}</p></blockquote></details>}
      <div className="suggested-step"><strong>Suggested next step</strong><p>{nextStep(result)}</p></div>
    </div>}
  </article>;
}

function SiteWatch({ data, busy, checkCampaign, monitorCampaign, actOnIncident }) {
  const { campaigns = [], incidents = [] } = data;
  const monitored = campaigns.filter((item) => item.monitoringEnabled);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState(null);
  const [detailError, setDetailError] = useState("");
  const selected = monitored.find((item) => item.campaign.id === selectedId) || null;
  useEffect(() => {
    if (!monitored.length) { setSelectedId(""); return; }
    if (!monitored.some((item) => item.campaign.id === selectedId)) setSelectedId(monitored[0].campaign.id);
  }, [campaigns, selectedId]);
  useEffect(() => {
    if (!selected) { setDetails(null); return; }
    let active = true;
    setDetails(null);
    setDetailError("");
    request("/api/campaigns/" + selected.campaign.id + "/monitoring").then((result) => {
      if (active) setDetails(result);
    }).catch((error) => { if (active) setDetailError(error.message); });
    return () => { active = false; };
  }, [selected?.campaign.id, selected?.lastMonitoringAt, campaigns.length]);
  const activeIncidents = incidents.filter((incident) => incident.status === "OPEN");
  return <>
    <PageHeading eyebrow="CAMPAIGN WATCH" title="Follow the campaign, wherever it sends people.">Each check refreshes this campaign from Meta, then inspects the destinations currently used by its ads.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Campaigns monitored" value={data.dashboard?.monitoredCampaigns ?? monitored.length} note="The campaign is refreshed before every check" tone="green" />
      <Metric label="Active incidents" value={activeIncidents.length} note="Changes or availability issues needing review" tone={activeIncidents.length ? "coral" : ""} />
      <Metric label="Last monitoring run" value={data.dashboard?.lastMonitoringRun ? formatDate(data.dashboard.lastMonitoringRun) : "Not yet"} note="Latest recorded campaign check" />
    </div>
    <div className="watch-layout">
      <section className="panel sites-panel"><div className="panel-heading"><div><h2>Monitored campaigns</h2><p>{monitored.length} active campaign{monitored.length === 1 ? "" : "s"}</p></div></div>
        {monitored.length === 0 ? <Empty title="No campaigns monitored">Open Campaigns and choose Monitor campaign. Its destinations will be refreshed from Meta at every check.</Empty> : <div className="site-list">{monitored.map((item) => {
          const campaign = item.campaign;
          const open = incidents.find((incident) => incident.campaignId === campaign.id && incident.status === "OPEN");
          return <button key={campaign.id} className={"site-option " + (selectedId === campaign.id ? "selected" : "")} onClick={() => setSelectedId(campaign.id)} aria-pressed={selectedId === campaign.id}>
            <span className={"watch-bullet " + (open ? "alert" : "ok")} aria-hidden="true" />
            <span className="site-option-main"><strong>{campaign.name}</strong><small>{campaign.objective || "Meta campaign"} | {item.monitoringDestinationCount} current destination{item.monitoringDestinationCount === 1 ? "" : "s"}</small></span><span className="site-option-state">{open ? "Incident" : "Monitoring"}</span>
          </button>;
        })}</div>}
      </section>
      <section className="panel site-detail-panel">
        {!selected ? <Empty title="Choose a campaign">Select a monitored campaign to inspect its latest Meta destinations and check history.</Empty> : <>
          <div className="site-detail-head"><div><div className="eyebrow">MONITORED CAMPAIGN</div><h2>{selected.campaign.name}</h2><p>{selected.campaign.objective || "Meta campaign"} | {selected.monitoringIntervalMinutes || 30}-minute checks</p></div><Status value={selected.lastMonitoringAt ? "PASS" : "UNKNOWN"} label={selected.lastMonitoringAt ? "Watch active" : "Waiting for first check"} /></div>
          <div className="site-timing"><div><span>Last check</span><strong>{formatDate(selected.lastMonitoringAt)}</strong></div><div><span>Next scheduled</span><strong>{formatDate(selected.nextMonitoringAt)}</strong></div><div><span>Current destinations</span><strong>{selected.monitoringDestinationCount ?? 0}</strong></div></div>
          <div className="site-actions"><Button kind="primary" disabled={busy === "campaign-monitor:" + selected.campaign.id} onClick={() => checkCampaign(selected.campaign.id)}>{busy === "campaign-monitor:" + selected.campaign.id ? "Refreshing campaign..." : "Refresh from Meta and check"}</Button><Button disabled={busy === "monitor:" + selected.campaign.id} onClick={() => monitorCampaign(selected.campaign.id, false)}>Pause campaign watch</Button></div>
          {detailError && <div className="alert error" role="alert">{detailError}</div>}
          {details && <><section className="history-section"><div className="section-heading"><h3>Current ad destinations</h3><span>Refreshed from Meta for each check</span></div>
            {details.destinations.length === 0 ? <Empty title="No current ad destinations">The latest Meta campaign data contains no destination URL to inspect.</Empty> : <div className="history-list">{details.destinations.map((destination) => {
              const latest = destination.latestSnapshot;
              const safeUrl = safeExternalUrl(destination.url);
              return <div key={destination.url} className="history-row destination-history-row"><span className={"history-mark " + (latest ? statusTone(latest.status) : "")} aria-hidden="true">{latest?.status === "PASS" ? "OK" : latest ? "!" : "-"}</span><div className="history-copy"><strong>{safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer">{destination.url}</a> : destination.url}</strong><small>{destination.ads?.length ? "Used by: " + destination.ads.join(", ") : "Current campaign destination"}</small><small>{latest ? latest.status + " | HTTP " + (latest.httpStatus || "?") + (latest.pageTitle ? " | " + latest.pageTitle : "") : "Not checked yet"}{latest?.errorCode ? " | " + latest.errorCode : ""}</small></div><time>{destination.lastCheckedAt ? formatDate(destination.lastCheckedAt) : (destination.snapshotCount || 0) + " checks"}</time></div>;
            })}</div>}
          </section><section className="history-section"><div className="section-heading"><h3>Campaign incidents</h3><span>{details.incidents.length} total</span></div>
            {details.incidents.length === 0 ? <p className="muted-copy">No incidents have been recorded for this campaign.</p> : <div className="incident-list">{details.incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} actOnIncident={actOnIncident} busy={busy} />)}</div>}
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
  const { meta, campaigns = [], preferences } = data;
  const connected = meta.connection?.status === "CONNECTED";
  const accounts = meta.accounts || [];
  return <>
    <PageHeading eyebrow="SETTINGS" title="Keep your checks useful." >Manage the Meta connection, campaign monitoring, and notification preferences.</PageHeading>
    <section className="panel settings-account"><div className="settings-title"><div><h2>Meta Ads account</h2><p>Read-only campaign access for QA. SteadySignal does not edit, pause, or publish ads.</p></div><span className="meta-letter" aria-hidden="true">M</span></div>
      <div className="settings-connection"><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? meta.connection.status || "Connected" : "Not connected"} />
        <div className="account-details">{accounts.length ? accounts.map((account) => <span key={account.id}><strong>{account.name}{account.selected ? " · Selected" : ""}</strong><small>{account.externalId} · {account.currency || "Currency unavailable"}</small></span>) : <span><strong>{connected ? "Account sync pending" : "No ad account connected"}</strong><small>{connected ? "Sync Meta Ads to discover available accounts." : "Connect using Meta OAuth; tokens stay on the server."}</small></span>}</div>
        {meta.connection?.lastSyncAt && <small>Last sync {formatDate(meta.connection.lastSyncAt)}</small>}
      </div>
      <div className="settings-actions">{connected ? <>
        <Button onClick={syncMeta} disabled={busy === "sync" || busy === "meta-accounts"}>{busy === "sync" ? "Syncing…" : accounts.length ? "Refresh account list" : "Discover ad accounts"}</Button>
        <Button onClick={() => window.location.assign("/api/integrations/meta/connect")}>Reconnect</Button><Button className="destructive-text" onClick={disconnectMeta}>Disconnect</Button>
      </> : <Button kind="primary" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}</div>
      {meta.connection?.lastError && <div className="alert error">{meta.connection.lastError}</div>}
    </section>
    <div className="settings-grid">
      <section className="panel settings-monitoring"><h2>Campaign monitoring</h2><p>Each scheduled check refreshes campaign and ad destinations from Meta before inspecting the pages.</p><div className="setting-line"><span>Check interval</span><strong>Every 30 minutes</strong></div><div className="setting-line"><span>Campaigns monitored</span><strong>{campaigns.filter((item) => item.monitoringEnabled).length} active</strong></div><a className="text-link" href="#/site-watch">Manage campaign watches</a></section>
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
