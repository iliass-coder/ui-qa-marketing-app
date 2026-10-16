import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { campaignPhase, formatDate, statusTone, valueText } from "./domain.js";
import { Icon } from "./icons.jsx";
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
    detail = ({
      META_ADS_MANAGEMENT_REQUIRED: "Reconnect Meta Ads and grant the ads_management permission to enable automatic pausing.",
      META_PERMISSION_DENIED: "Meta did not grant the permission required to pause campaigns. Reconnect Meta Ads and approve the requested access.",
      EMAIL_VERIFICATION_NOT_CONFIGURED: "Email sign-up is not enabled yet. Configure SMTP and enable email verification, or sign up with Google.",
      EMAIL_DELIVERY_FAILED: "We could not send the verification email. Check the SMTP settings and try again.",
      EMAIL_NOT_VERIFIED: "Verify your email using the link we sent before signing in.",
      EMAIL_ALREADY_REGISTERED: "An account already uses this email. Sign in instead.",
      GOOGLE_NOT_CONFIGURED: "Google sign-in is not configured on the backend yet.",
      GOOGLE_ACCOUNT_NOT_AUTHORIZED: "No account uses that Google email yet. Switch to sign up to create a workspace."
    })[detail] || detail;
    const error = new Error(detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
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

function Button({ children, icon, kind = "secondary", className = "", ...props }) {
  return <button className={`button ${kind} ${className}`} {...props}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

function Status({ value, label }) {
  const raw = label || value || "Not checked";
  const text = ({ STALE: "Out of date", PASS: "Passed", FAIL: "Needs action", WARNING: "Review needed", UNKNOWN: "Not checked", OPEN: "Open", CONNECTED: "Connected", RESOLVED: "Resolved" })[raw] || metaCodeLabel(raw);
  return <span className={`status ${statusTone(value)}`}><span className="status-dot" aria-hidden="true" />{text}</span>;
}

function Empty({ title, children, action }) {
  return <div className="empty-state"><span className="empty-mark"><Icon name="shield" size={25} /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

function PageHeading({ eyebrow, title, children, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children && <p>{children}</p>}</div>{action && <div className="heading-actions">{action}</div>}</div>;
}

function Metric({ label, value, note, tone = "", icon }) {
  return <section className={`metric-card ${tone}`}><div className="metric-top"><span className="metric-label">{label}</span><Icon name={icon || (tone === "coral" ? "warning" : tone === "green" ? "watch" : "campaigns")} size={19} /></div><div className={`metric-value ${String(value).length > 12 ? "is-date" : ""}`}>{value}</div><div className="metric-note">{note}</div></section>;
}

function App() {
  const [auth, setAuth] = useState("loading");
  const [user, setUser] = useState(null);
  const [authCallback] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const result = { ssoError: params.get("sso_error"), emailVerified: params.get("email_verified") };
    if (result.ssoError || result.emailVerified) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    }
    return result;
  });
  const [loginError, setLoginError] = useState(() => authCallback.ssoError === "no_account"
    ? "No workspace uses that Google email yet. Switch to Sign up to create one."
    : authCallback.ssoError ? "Google sign-in could not be completed. Please try again." : "");
  const [loginNotice, setLoginNotice] = useState(() => authCallback.emailVerified === "success"
    ? "Email verified. You can sign in now."
    : authCallback.emailVerified ? "That link is invalid or expired. Sign in with your password, then request a new verification link." : "");
  const [loginBusy, setLoginBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [emailSignupEnabled, setEmailSignupEnabled] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [signupWorkspaceName, setSignupWorkspaceName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [canResendVerification, setCanResendVerification] = useState(false);
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
    request("/api/auth/google/status")
      .then((result) => {
        setGoogleEnabled(Boolean(result.enabled));
        setEmailSignupEnabled(Boolean(result.emailSignupEnabled));
      })
      .catch(() => setGoogleEnabled(false));
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
      if (authMode === "signup") {
        if (form.get("password") !== form.get("confirmPassword")) {
          setLoginError("The passwords do not match.");
          return;
        }
        await request("/api/auth/register", {
          method: "POST",
          body: {
            name: form.get("name"),
            workspaceName: form.get("workspaceName"),
            email: form.get("email"),
            password: form.get("password")
          }
        });
        setAuthEmail(String(form.get("email") || ""));
        setLoginNotice("Account created. Check your inbox for a verification link before signing in.");
        setAuthMode("signin");
      } else {
        await request("/api/auth/login", { method: "POST", body: { email: form.get("email"), password: form.get("password") } });
        setAuth("signed-in");
      }
    } catch (error) {
      setCanResendVerification(error.message === "EMAIL_NOT_VERIFIED");
      setLoginError(error.message === "INVALID_CREDENTIALS" ? "Email or password was not accepted." : error.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const resendVerification = async () => {
    setLoginBusy(true);
    setLoginError("");
    try {
      await request("/api/auth/resend-verification", {
        method: "POST",
        body: { email: authEmail }
      });
      setCanResendVerification(false);
      setLoginNotice("If this account still needs verification, a new link has been sent.");
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginBusy(false);
    }
  };

  const startGoogleAuth = () => {
    const params = new URLSearchParams({ flow: authMode });
    if (authMode === "signup") params.set("workspaceName", signupWorkspaceName);
    window.location.assign(`/api/auth/google/start?${params.toString()}`);
  };

  const logout = async () => {
    setBusy("logout");
    setLoadError("");
    try {
      await request("/api/auth/logout", { method: "POST" });
      setUser(null);
      setData(null);
      setAuth("signed-out");
    } catch (error) {
      if (error.status === 401) {
        setUser(null);
        setData(null);
        setAuth("signed-out");
      } else {
        setLoadError(`Could not sign out: ${error.message}`);
      }
    } finally {
      setBusy("");
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
          recoveryAlertsEnabled: form.get("recoveryAlertsEnabled") === "on",
          autoPauseCampaignOnWebsiteDown: form.get("autoPauseCampaignOnWebsiteDown") === "on"
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

  const actOnIncident = async (incident, action) => {
    const note = action === "resolve"
      ? "Resolution requested; verify recovery with a fresh landing page inspection."
      : action === "mark-intentional"
        ? "Marked intentional by the user from campaign monitoring."
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
    return <main className="login-page"><aside className="login-story"><div className="login-brand"><Brand /></div><div className="login-story-copy"><div className="health-kicker">A CLEARER SIGNAL</div><h2>Confidence before <br />every click.</h2><p>From your first campaign check to the pages already live. Stay one step ahead of what needs your attention.</p><div className="auth-diagram" aria-hidden="true"><div><Icon name="campaigns" size={27} /><span>Your campaign</span></div><span className="diagram-connector" /><div className="diagram-center"><Icon name="shield" size={35} /><span>SteadySignal</span></div><span className="diagram-connector" /><div><Icon name="globe" size={27} /><span>Landing page</span></div></div></div><div className="login-story-foot"><Icon name="shield" size={16} /> Thoughtful checks. Steadier campaigns.</div></aside><div className="login-form-region"><section className="login-card">
      <div className="eyebrow">YOUR CAMPAIGN WORKSPACE</div><h1>{authMode === "signup" ? "Make room for clarity." : "Welcome back."}</h1><p>{authMode === "signup" ? "Create a workspace for campaigns you can feel confident about." : "Sign in and see how your campaigns are doing."}</p>
      {loadError && <div className="alert error" role="alert">{loadError} Check that the backend is running, then try again.</div>}
      {loginError && <div className="alert error" role="alert">{loginError}</div>}
      {loginNotice && <div className="alert success" role="status">{loginNotice}</div>}
      {authMode === "signup" && !emailSignupEnabled && <div className="alert" role="status">{googleEnabled ? "Email registration is currently unavailable. Continue with Google to create your workspace." : "Email registration is currently unavailable. Contact your workspace administrator."}</div>}
      {googleEnabled && <>
        <Button type="button" className="google-button" disabled={!googleEnabled || (authMode === "signup" && !signupWorkspaceName.trim())} onClick={startGoogleAuth} title={!googleEnabled ? "Google sign-in is not configured" : undefined}>
          <span className="google-g" aria-hidden="true">G</span>{authMode === "signup" ? "Sign up with Google" : "Sign in with Google"}
        </Button>
        {authMode === "signup" && !signupWorkspaceName.trim() && <p className="google-signup-hint">Enter a workspace name below to continue with Google.</p>}
        <div className="login-divider"><span>or continue with email</span></div>
      </>}
      <form key={authMode} onSubmit={login} className="form-stack">
        {authMode === "signup" && <>
          <label>Your name<input type="text" name="name" autoComplete="name" required maxLength="80" /></label>
          <label>Workspace name<input type="text" name="workspaceName" autoComplete="organization" required minLength="2" maxLength="80" value={signupWorkspaceName} onChange={(event) => setSignupWorkspaceName(event.target.value)} /></label>
        </>}
        <label>Email address<input type="email" name="email" autoComplete="email" required maxLength="254" value={authEmail} onChange={(event) => { setAuthEmail(event.target.value); setCanResendVerification(false); }} /></label>
        <label>Password<input type="password" name="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} required minLength={authMode === "signup" ? 16 : undefined} maxLength="200" /></label>
        {authMode === "signup" && <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" required minLength="16" maxLength="200" /></label>}
        <Button kind="primary" type="submit" disabled={loginBusy}>{loginBusy ? (authMode === "signup" ? "Creating account…" : "Signing in…") : (authMode === "signup" ? "Create account" : "Sign in")}</Button>
      </form><p className="fine-print"><Icon name="shield" size={13} />{authMode === "signup" ? "Use at least 16 characters. We'll verify your email." : "A secure space for your campaign work."}</p>
      {authMode === "signin" && canResendVerification && <Button type="button" className="resend-verification" disabled={loginBusy || !authEmail.trim()} onClick={resendVerification}>Resend verification email</Button>}
      <p className="auth-switch">{authMode === "signup" ? "Already have an account?" : "New to SteadySignal?"} <button type="button" className="text-button" onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setLoginError(""); }}>{authMode === "signup" ? "Sign in" : "Create an account"}</button></p>
    </section><p className="login-form-foot">SteadySignal · Campaign assurance, made clear.</p></div></main>;
  }
  if (!data) return <main className="center-state"><div className="spinner" /><p>Loading workspace data…</p>{loadError && <p role="alert">{loadError} <button className="text-button" onClick={reload}>Try again</button></p>}</main>;

  const connection = data.meta?.connection;
  const connected = connection?.status === "CONNECTED";
  const lastSync = connection?.lastSyncAt ? new Date(connection.lastSyncAt).getTime() : null;
  const metaSyncIsStale = connected && lastSync && Date.now() - lastSync > 24 * 60 * 60 * 1000;
  const activeNav = route.page === "report" ? "campaigns" : route.page;

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
    <aside className="sidebar">
      <a href="#/overview" className="brand-link" aria-label="SteadySignal overview"><Brand /></a>
      <div className="workspace-card"><span className="workspace-monogram">{(user?.workspace?.name || "W").slice(0, 1).toUpperCase()}</span><span><strong>{user?.workspace?.name || "My workspace"}</strong><small>Campaign workspace</small></span></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <NavItem id="overview" active={activeNav === "overview"} icon="overview" label="Overview" />
        <NavItem id="campaigns" active={activeNav === "campaigns"} icon="campaigns" label="Campaigns" count={data.campaigns.length} />
        <NavItem id="site-watch" active={activeNav === "site-watch"} icon="watch" label="Campaign watch" count={data.campaigns.filter((item) => item.monitoringEnabled).length} />
        <NavItem id="settings" active={activeNav === "settings"} icon="settings" label="Settings" />
      </nav>
      <div className="sidebar-account">
        <div className="connection-emblem"><Icon name="meta" size={24} /><span className={`signal-dot ${connected ? "online" : ""}`} /></div>
        <strong>{connected ? "Connected to Meta" : "Connect your Meta account"}</strong>
        <p>{connected ? `${data.meta?.accounts?.length || 0} ad accounts available` : "Bring your campaigns into one clear view."}</p>
        <a href="#/settings">Manage connection <Icon name="arrow" size={14} /></a>
      </div>
      <div className="sidebar-bottom"><span className="user-avatar">{(user?.user?.name || "U").slice(0, 1).toUpperCase()}</span><span className="user-copy"><strong>{user?.user?.name || "Workspace member"}</strong><small>Your workspace</small></span><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={logout} disabled={busy === "logout"}><Icon name="logout" size={18} /></button></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="breadcrumbs"><Icon name={activeNav === "site-watch" ? "watch" : activeNav} size={17} /><span>Workspace</span><Icon name="chevron" size={12} /><strong>{route.page === "report" ? "QA report" : route.page === "site-watch" ? "Campaign watch" : route.page[0].toUpperCase() + route.page.slice(1)}</strong></div>
        <div className="topbar-right"><span className="workspace-date"><Icon name="calendar" size={15} />{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date())}</span><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? "Meta connected" : "Meta disconnected"} /><button className="icon-button mobile-signout" title="Sign out" aria-label="Sign out" onClick={logout} disabled={busy === "logout"}><Icon name="logout" size={17} /></button></div>
      </header>
      <div className={`page-content page-${route.page}`} id="main-content" tabIndex="-1">
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
      <footer className="workspace-footer"><span>SteadySignal <span aria-hidden="true">/</span> Campaign assurance</span><span><Icon name="shield" size={13} /> Your campaigns. A clearer picture.</span></footer>
      {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification">×</button></div>}
    </main>
  </div>;
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><svg viewBox="0 0 30 30" fill="none" aria-hidden="true"><path d="M5 17h4l3-9 5 15 3-10h5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="brand-name">steady<span>signal</span><small>CAMPAIGN ASSURANCE</small></span></div>;
}

function NavItem({ id, active, icon, label, count }) {
  return <a className={`nav-item ${active ? "active" : ""}`} href={`#/${id}`} aria-current={active ? "page" : undefined} title={label}><Icon name={icon} size={19} /><span className="nav-label">{label}</span>{count != null && <span className="nav-count">{count}</span>}</a>;
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
    <PageHeading eyebrow="THE BIG PICTURE" title="Campaign overview" action={meta.connection ? <Button kind="primary" icon="refresh" onClick={syncMeta} disabled={busy === "sync"}>{busy === "sync" ? "Syncing campaigns…" : "Sync campaigns"}</Button> : <Button kind="primary" icon="link" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}>Campaign readiness and landing-page health, in one place.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Total campaigns" value={dashboard.importedCampaigns ?? campaigns.length} note={meta.accounts?.some((account) => account.selected) ? `From ${meta.accounts.filter((account) => account.selected).length} selected ad account${meta.accounts.filter((account) => account.selected).length === 1 ? "" : "s"}` : "From your connected Meta account"} />
      <Metric label="Awaiting review" value={needsReview.length} note="Campaigns that need a fresh QA check" tone="coral" />
      <Metric label="On campaign watch" value={dashboard.monitoredCampaigns ?? monitored.length} note="Destinations checked every 60 seconds" tone="green" />
    </div>
    <section className="health-banner" aria-label="Campaign health summary">
      <div className="health-copy"><div className="health-kicker"><span className="signal-dot" /> WORKSPACE PULSE</div><h2>{openIncidents.length ? `${openIncidents.length} incident${openIncidents.length === 1 ? " needs" : "s need"} a closer look.` : "Keep your next launch in focus."}</h2><p>{openIncidents.length ? "Review changes and availability issues across your monitored landing pages." : "Review your campaign details and landing pages, then keep watch as things change."}</p><a href={openIncidents.length ? "#/site-watch" : "#/campaigns"}>{openIncidents.length ? "Review open incidents" : "Explore your campaigns"}<Icon name="arrow" size={17} /></a></div>
      <div className="health-coverage"><div className="coverage-ring" style={{ "--coverage": `${campaigns.length ? Math.round(monitored.length / campaigns.length * 100) : 0}%` }}><div><strong>{monitored.length}<span>/{campaigns.length}</span></strong><small>ON WATCH</small></div></div><div className="coverage-copy"><span className="coverage-caption">MONITORING COVERAGE</span><strong>Eyes on your<br />landing pages.</strong><small><span className="signal-dot online" /> Checks every minute</small></div></div>
    </section>
    <div className="overview-grid">
      <section className="panel campaign-queue">
        <div className="panel-heading"><div className="section-title"><span className="section-icon"><Icon name="campaigns" /></span><div><h2>Up next for review <span className="count-label">{needsReview.length}</span></h2><p>A fresh check before your next launch.</p></div></div><a className="text-link" href="#/campaigns">View all <Icon name="arrow" size={15} /></a></div>
        {needsReview.length === 0 ? <Empty title={campaigns.length ? "You're up to date" : "Your campaigns will appear here"}>{campaigns.length ? "No campaigns are waiting for review." : meta.connection ? "Sync Meta Ads to bring your campaigns into this workspace." : "Connect a Meta Ads account to get started."}</Empty> :
          <div className="campaign-list">{needsReview.slice(0, 4).map((item) => <CampaignRow key={item.campaign.id} item={item} busy={busy} runQa={runQa} />)}</div>}
      </section>
      <section className="panel watch-summary">
        <div className="panel-heading"><div className="section-title"><span className="section-icon"><Icon name="watch" /></span><div><h2>Always on watch</h2><p>Your landing pages, in focus.</p></div></div><span className={`live-label ${monitored.length ? "" : "is-inactive"}`}><span className={`signal-dot ${monitored.length ? "online" : ""}`} />{monitored.length ? "LIVE" : "INACTIVE"}</span></div>
        {monitored.length === 0 ? <Empty title="No monitored campaigns">Use Monitor campaign in the Campaigns list to start a watch.</Empty> :
          <div className="watch-list">{monitored.slice(0, 4).map((item) => <CampaignWatchSummary key={item.campaign.id} item={item} incident={openIncidents.find((entry) => entry.campaignId === item.campaign.id)} />)}</div>}
        <div className="watch-footer"><span><Icon name="clock" size={14} /> Every 60 seconds</span><a className="text-link" href="#/site-watch">View monitoring <Icon name="arrow" size={14} /></a></div>
      </section>
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div className="section-title"><span className="section-icon"><Icon name="clock" /></span><div><h2>Recently updated</h2><p>The latest from your connected ad accounts.</p></div></div><a className="text-link" href="#/campaigns">All campaigns <Icon name="arrow" size={15} /></a></div>
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
    <div className="campaign-row-main"><a className="campaign-title" href={`#/report/${c.id}`}>{c.name}</a><div className="campaign-sub">{campaignObjective(c.objective)} <span>·</span> {item.adCount ?? 0} ad{item.adCount === 1 ? "" : "s"}</div>
    </div>
    <Status value={item.verdict || item.qaState} label={item.qaState || "Not checked"} />
    {needsRun ? <Button className="row-action" onClick={() => runQa(c.id)} disabled={busy === `qa:${c.id}`}>{busy === `qa:${c.id}` ? "Checking…" : "Run check"}<Icon name="arrow" size={14} /></Button> : <Button className="row-action" onClick={() => navigate(`report/${c.id}`)}>View report<Icon name="arrow" size={14} /></Button>}
  </article>;
}

function CampaignWatchSummary({ item, incident }) {
  const campaign = item.campaign;
  return <a className="watch-item" href="#/site-watch"><span className={`watch-state ${incident ? "is-incident" : "is-ok"}`}><Icon name={incident ? "warning" : "globe"} size={18} /></span><span className="watch-item-copy"><strong>{campaign.name}</strong><small>{incident ? "Landing page needs attention" : item.lastMonitoringAt ? "Last check " + formatDate(item.lastMonitoringAt, { dateStyle: undefined, timeStyle: "short" }) : "Waiting for the first check"}</small></span><Icon name="chevron" size={14} /></a>;
}

function campaignObjective(value) {
  return ({ OUTCOME_SALES: "Sales", OUTCOME_LEADS: "Leads", OUTCOME_TRAFFIC: "Traffic", OUTCOME_AWARENESS: "Awareness", OUTCOME_ENGAGEMENT: "Engagement", OUTCOME_APP_PROMOTION: "App promotion" })[value] || (value ? metaCodeLabel(value) : "Meta campaign");
}

function metaCodeLabel(value) {
  const text = String(value || "");
  return /^[A-Z][A-Z_]+$/.test(text) ? text.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : text;
}

function Campaigns({ data, busy, runQa, monitorCampaign, syncMeta, selectMetaAccounts }) {
  const { campaigns = [], meta = {} } = data;
  const [filter, setFilter] = useState("All campaigns");
  const [search, setSearch] = useState("");
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
    if (!`${item.campaign?.name || ""} ${campaignObjective(item.campaign?.objective)}`.toLowerCase().includes(search.toLowerCase().trim())) return false;
    const phase = campaignPhase(item.campaign);
    if (filter === "Before launch") return phase !== "Live";
    if (filter === "Live") return phase === "Live";
    return true;
  });
  const nonLive = accountCampaigns.filter((item) => campaignPhase(item.campaign) !== "Live");
  const needsAttention = nonLive.filter((item) => !item.lastQa || ["FAIL", "WARNING", "STALE", "UNKNOWN"].includes(item.qaState || item.verdict)).length;
  const changeAccount = (event) => {
    const value = event.target.value;
    setAccountFilter(value);
    selectMetaAccounts(value === "__all__" ? accounts.map((account) => account.externalId) : value ? [value] : []);
  };
  return <>
    <PageHeading eyebrow="CAMPAIGN LIBRARY" title="Your campaigns" action={<div className="campaign-heading-actions">{accounts.length > 0 && <label className="account-filter-label"><span className="sr-only">Ad account</span><select value={accountFilter} onChange={changeAccount} disabled={busy === "sync" || busy === "meta-accounts"}>
      <option value="">Select an ad account</option>
      {accounts.length > 1 && <option value="__all__">All ad accounts</option>}
      {accounts.map((account) => <option key={account.id} value={account.externalId}>{account.name} ({account.externalId.replace(/^act_/, "")})</option>)}
    </select></label>}<Button kind="primary" icon="refresh" onClick={syncMeta} disabled={!meta.connection || busy === "sync" || busy === "meta-accounts"}>{busy === "sync" ? "Syncing…" : "Sync campaigns"}</Button></div>}>Every campaign, every destination. All in one clear view.</PageHeading>
    <div className="metrics-grid">
      <Metric label="Awaiting review" value={needsAttention} note="Ready for a fresh campaign check" tone="coral" />
      <Metric label="Before launch" value={nonLive.length} note="Draft, paused, or scheduled campaigns" />
      <Metric label="Currently live" value={accountCampaigns.length - nonLive.length} note="Active campaigns in this ad account" tone="green" />
    </div>
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="filter-tabs" role="group" aria-label="Filter campaigns">{["All campaigns", "Before launch", "Live"].map((name) => <button key={name} className={`filter-tab ${filter === name ? "selected" : ""}`} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}<span>{name === "All campaigns" ? accountCampaigns.length : name === "Before launch" ? nonLive.length : accountCampaigns.length - nonLive.length}</span></button>)}</div><label className="search-field"><Icon name="search" size={17} /><span className="sr-only">Search campaigns</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns…" /></label></div>
      {busy === "meta-accounts" ? <div className="center-state inline campaign-loading" role="status" aria-live="polite"><div className="spinner" aria-hidden="true" /><p>Loading campaigns for the selected ad account…</p></div> : rows.length ? <CampaignTable items={rows} busy={busy} runQa={runQa} monitorCampaign={monitorCampaign} /> : <Empty title={accountCampaigns.length ? "No campaigns in this view" : "No campaign data yet"}>{accountCampaigns.length ? "Choose another campaign filter." : meta.connection ? (accounts.length && !accountFilter ? "Choose an ad account from the dropdown to sync and display its campaigns." : "No campaigns were returned for this ad account. Try syncing again or choose another account.") : "Connect Meta Ads to import real campaigns."}</Empty>}
      <div className="table-footer"><span>{rows.length} campaign{rows.length === 1 ? "" : "s"}{search && ` matching “${search}”`}</span><span><Icon name="meta" size={15} /> Synced from Meta Ads</span></div>
    </section>
  </>;
}

function CampaignTable({ items, busy, runQa, monitorCampaign }) {
  return <div className="table-wrap"><table className="data-table">
    <thead><tr><th scope="col">Campaign</th><th scope="col">Status</th><th scope="col">Launch date</th><th scope="col">Latest check</th>{monitorCampaign && <th scope="col">Monitoring</th>}<th scope="col"><span className="sr-only">Action</span></th></tr></thead>
    <tbody>{items.map((item) => {
      const campaign = item.campaign;
      const phase = campaignPhase(campaign);
      const status = item.qaState || "Not checked";
      return <tr key={campaign.id}>
        <td><div className="table-campaign"><span className="campaign-initial small" aria-hidden="true">{(campaign.name || "C").slice(0, 1).toUpperCase()}</span><span><a className="campaign-title" href={`#/report/${campaign.id}`}>{campaign.name}</a><small>{campaignObjective(campaign.objective)} · {item.adCount ?? 0} ad{item.adCount === 1 ? "" : "s"}</small></span></div></td>
        <td><Status value={phase === "Live" ? "ACTIVE" : "UNKNOWN"} label={phase} /></td>
        <td>{formatDate(campaign.startAt, { dateStyle: "medium", timeStyle: undefined })}</td>
        <td><Status value={item.verdict || "UNKNOWN"} label={status} /></td>
        {monitorCampaign && <td><Button icon="watch" className={`monitor-button ${item.monitoringEnabled ? "is-on" : ""}`} disabled={busy === "monitor:" + campaign.id || (!item.monitoringEnabled && !item.monitoringAvailable)} onClick={() => monitorCampaign(campaign.id, !item.monitoringEnabled)} title={!item.monitoringEnabled && !item.monitoringAvailable ? "No ad destination is currently available. Sync this campaign from Meta first." : `${item.monitoringDestinationCount || 0} landing page destinations`}>{busy === "monitor:" + campaign.id ? "Updating…" : item.monitoringEnabled ? "Pause watch" : item.monitoringAvailable ? "Start watch" : "No destination"}</Button></td>}
        <td className="action-cell">{item.lastQa && !["STALE", "Not checked"].includes(status) ? <Button className="row-action" onClick={() => navigate(`report/${campaign.id}`)}>View report<Icon name="arrow" size={14} /></Button> : <Button className="row-action" disabled={busy === `qa:${campaign.id}`} onClick={() => runQa(campaign.id)}>{busy === `qa:${campaign.id}` ? "Checking…" : "Run check"}<Icon name="arrow" size={14} /></Button>}</td>
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
      <div><span>Optimization</span><strong>{metaCodeLabel(adSet.optimizationGoal) || "Not provided"}</strong></div>
      <div><span>Budget</span><strong>{budget}</strong></div>
      <div><span>Billing / bid</span><strong>{metaCodeLabel(adSet.billingEvent) || "Not provided"}{adSet.bidStrategy ? ` · ${metaCodeLabel(adSet.bidStrategy)}` : ""}{bid}</strong></div>
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
  const reportTypes = new Set(["budget", "destination_url", "availability", "stock_status", "server_response_time", "product_consistency", "market_language", "offer_eligibility", "promotion_consistency", "service_region", "copy_quality"]);
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
      <section className="panel creative-panel"><div className="campaign-info-heading"><div><div className="eyebrow">CAMPAIGN OVERVIEW</div><h2>{campaign.name}</h2><p>{campaignObjective(campaign.objective)}</p></div><Status value={campaignPhase(campaign) === "Live" ? "ACTIVE" : campaign.status || "UNKNOWN"} label={campaignPhase(campaign)} /></div>
        <div className="campaign-count-strip"><span>{adSets.length} ad set{adSets.length === 1 ? "" : "s"}</span><span>{ads.length} ad{ads.length === 1 ? "" : "s"}</span></div>
        <div className="campaign-facts">
          <div><span>Campaign budget</span><strong>{campaign.dailyBudget ? `${formatMetaBudget(campaign.dailyBudget, campaign.currency)} per day` : campaign.lifetimeBudget ? `${formatMetaBudget(campaign.lifetimeBudget, campaign.currency)} lifetime` : "Set across ad sets"}</strong></div>
          <div><span>Campaign schedule</span><strong>{campaign.startAt ? formatDate(campaign.startAt, { dateStyle: "medium", timeStyle: undefined }) : "No start date"} – {campaign.endAt ? formatDate(campaign.endAt, { dateStyle: "medium", timeStyle: undefined }) : "No end date"}</strong></div>
        </div>
        {adSets.length === 0 ? <Empty title="Ad set details are not available yet">Sync this ad account to import its ad sets and targeting settings.</Empty> : adSets.map((adSet) => <AdSetCard key={adSet.id} adSet={adSet} ads={ads.filter((ad) => ad.adSetId === adSet.id)} />)}
        {unassignedAds.length > 0 && <section className="unassigned-ads"><h3>Ads without ad set details</h3>{unassignedAds.map((ad) => <AdCreativeCard key={ad.id} ad={ad} />)}</section>}
        {ads.length === 0 && adSets.length > 0 && <p className="muted-copy">No ads were returned for this campaign.</p>}
      </section>
      <section className="panel finding-panel"><div className="panel-heading"><div><h2>Launch checklist</h2><p>{actionCount ? `${actionCount} item${actionCount === 1 ? "" : "s"} to address` : "No blocking issues found"}{reviewCount ? ` · ${reviewCount} need your judgment` : ""}</p></div><small className="report-check-count">{coreResults.length} checks</small></div>
        {!detail.run ? <Empty title="Ready for your first check">Run a campaign check to review your ads and landing-page destinations.</Empty> : ["QUEUED", "RUNNING"].includes(detail.run.status) ? <Empty title="Your check is running">You can review the campaign details while we inspect its ads and destinations.</Empty> : coreResults.length === 0 ? <Empty title="No checks to display">The latest run has no results for the selected launch checks.</Empty> : <div className="finding-list">{coreResults.map((result) => <Finding key={result.id} result={result} evidence={detail.evidence[result.id] || []} />)}</div>}
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
  const type = result.checkType;
  if (type === "destination_url") {
    if (side === "expected") return ["An HTTP(S) destination URL should be available from the ad creative."];
    return value ? [`Destination URL: ${String(value)}`] : ["No destination URL found in the available Meta creative fields."];
  }
  if (type === "stock_status") {
    if (side === "expected") return ["The landing page should not show an out-of-stock notice."];
    return value?.detectedText ? [`Detected notice: ${value.detectedText}`] : ["No recognized out-of-stock phrase found in captured page text."];
  }
  if (type === "server_response_time") {
    if (side === "expected") return [`Server response should be within ${Number(value?.thresholdMs ?? 3000).toLocaleString()} ms.`];
    return value?.responseTimeMs != null
      ? [`Measured server response: ${Number(value.responseTimeMs).toLocaleString()} ms`]
      : ["Server response time could not be measured."];
  }
  if (value == null || value === "") return ["No detail recorded"];
  if (typeof value !== "object") return [String(value)];
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
  if (type === "promotion_consistency") {
    const offers = side === "expected" ? value.adOffer : value.landingPageOffer;
    const evidence = side === "expected" ? value.adEvidence : value.pageEvidence;
    const label = side === "expected" ? "Ad offer" : "Landing-page offer";
    const lines = [];
    if (Array.isArray(offers) && offers.length) {
      lines.push(`${label}: ${offers.map((offer) => {
        if (offer.type === "PERCENT_OFF") return `${offer.value}% off`;
        if (offer.type === "AMOUNT_OFF") {
          const [currency, amount] = String(offer.value).split(":");
          const symbol = ({ USD: "$", EUR: "€", GBP: "£" })[currency] || "";
          return `${symbol}${amount} off${symbol ? "" : ` (${currency})`}`;
        }
        return `${offer.value} promo code`;
      }).join(", ")}`);
    } else {
      lines.push(`No explicit promotion found in ${side === "expected" ? "the ad" : "captured landing-page text"}.`);
    }
    if (Array.isArray(evidence) && evidence.length) lines.push(`Evidence: ${evidence.join(" · ")}`);
    return lines;
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
  if (message === "AI_NOT_CONFIGURED") return "Campaign and landing-page data were captured, but AI checks are not configured for this workspace. Configure the AI endpoint, key, and model to enable this review.";
  if (message === "INSUFFICIENT_SOURCES") return "The AI check did not receive enough ad-copy or landing-page text to compare.";
  const httpError = message.match(/^AI_UNAVAILABLE_HTTP_(\d{3})$/);
  if (httpError) return `Campaign and landing-page data were captured, but the AI endpoint returned HTTP ${httpError[1]}. Check the endpoint, API key, model, and provider logs.`;
  const requestError = message.match(/^AI_REQUEST_FAILED_([A-Za-z]+)$/);
  if (requestError) return `Campaign and landing-page data were captured, but the AI request failed (${requestError[1]}). Check worker network access and AI provider settings.`;
  if (message.startsWith("AI_INVALID_RESPONSE")) return "Campaign and landing-page data were captured, but the AI provider returned a response the app could not use. Check the configured model's JSON response support and worker logs.";
  if (message === "AI_RESPONSE_TRUNCATED" || message === "AI_EMPTY_RESPONSE" || message === "AI_REFUSED") return `Campaign and landing-page data were captured, but the AI provider returned ${message.replace("AI_", "").toLowerCase().replaceAll("_", " ")}. Check the model response and provider logs.`;
  if (/^AI_(UNAVAILABLE|INVALID|EMPTY|RESPONSE|REFUSED|MISSING_CHECK|INVALID_STATUS|CONFIDENCE)/.test(message)) return "Campaign and landing-page data were captured, but the AI service did not return a usable result for this check. Check the AI integration and worker logs, then rerun QA.";
  return message;
}

function severityOrder(severity, status) {
  const rank = { critical: 0, major: 1, moderate: 2, minor: 3 };
  return (rank[String(severity || "").toLowerCase()] ?? 4) * 10 + (status === "FAIL" ? 0 : status === "WARNING" ? 1 : 2);
}

function nextStep(result) {
  const type = String(result.checkType || "").toLowerCase();
  if (type === "stock_status") return "Confirm the product is in stock and that the landing page reflects its current inventory.";
  if (type === "server_response_time") return "Check hosting, redirects, and server response time; this check does not measure browser rendering or full page load.";
  if (type === "destination_url") return "Add or select a website destination in the Meta creative, sync the campaign again, and rerun QA.";
  if (type === "promotion_consistency") return "Confirm that the discount or promo code shown in the ad matches the landing page, then rerun QA.";
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
    destination_url: "Destination URL found",
    stock_status: "Out-of-stock notice",
    server_response_time: "Server response time",
    budget: "Daily budget · $100 USD limit",
    availability: "Landing page is up",
    product_consistency: "Product matches campaign",
    market_language: "Language fits targeted locations",
    offer_eligibility: hasCombinedLocationEvidence ? "Offer and delivery availability by location" : "Offer eligibility by location",
    promotion_consistency: "Ad offer matches landing page",
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
    <PageHeading eyebrow="CONTINUOUS MONITORING" title="Always on watch" action={<span className="monitoring-label"><span className={`signal-dot ${monitored.length ? "online" : ""}`} />{monitored.length ? "Checks every 60 seconds" : "No active watches"}</span>}>Keep a close eye on the pages your campaigns send people to.</PageHeading>
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
            <span className={`watch-state ${open ? "is-incident" : "is-ok"}`}><Icon name={open ? "warning" : "globe"} size={18} /></span>
            <span className="site-option-main"><strong>{campaign.name}</strong><small>{campaignObjective(campaign.objective)} · {item.monitoringDestinationCount} destination{item.monitoringDestinationCount === 1 ? "" : "s"}</small></span><Icon name="chevron" size={14} />
          </button>;
        })}</div>}
      </section>
      <section className="panel site-detail-panel">
        {!selected ? <Empty title="Choose a campaign">Select a monitored campaign to inspect its latest Meta destinations and check history.</Empty> : <>
          <div className="site-detail-head"><div><div className="eyebrow">MONITORED CAMPAIGN</div><h2>{selected.campaign.name}</h2><p>{campaignObjective(selected.campaign.objective)} · Checked every minute</p></div><Status value={selected.lastMonitoringAt ? "PASS" : "UNKNOWN"} label={selected.lastMonitoringAt ? "Watch active" : "Waiting for first check"} /></div>
          <div className="site-timing"><div><span>Last check</span><strong>{formatDate(selected.lastMonitoringAt)}</strong></div><div><span>Next scheduled</span><strong>{formatDate(selected.nextMonitoringAt)}</strong></div><div><span>Current destinations</span><strong>{selected.monitoringDestinationCount ?? 0}</strong></div></div>
          <div className="site-actions"><Button kind="primary" icon="refresh" disabled={busy === "campaign-monitor:" + selected.campaign.id} onClick={() => checkCampaign(selected.campaign.id)}>{busy === "campaign-monitor:" + selected.campaign.id ? "Checking campaign…" : "Check now"}</Button><Button icon="watch" disabled={busy === "monitor:" + selected.campaign.id} onClick={() => monitorCampaign(selected.campaign.id, false)}>Pause watch</Button></div>
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
  const canPauseMetaCampaigns = meta.connection?.scopes?.includes("ads_management") === true;
  const accounts = meta.accounts || [];
  return <>
    <PageHeading eyebrow="MAKE IT YOURS" title="Workspace settings" >Your connections, monitoring, and notifications. Just the way you need them.</PageHeading>
    <section className="panel settings-account"><div className="settings-title"><div className="section-title"><span className="integration-icon"><Icon name="meta" size={28} /></span><div><h2>Meta Ads</h2><p>Your campaign source, connected securely.</p></div></div><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? "Connected" : "Not connected"} /></div>
      <div className="settings-connection"><div><strong>{accounts.length} ad account{accounts.length === 1 ? "" : "s"} available</strong><p>{accounts.filter((account) => account.selected).length} selected for campaign sync</p></div>{meta.connection?.lastSyncAt && <small><Icon name="clock" size={14} /> Last synced {formatDate(meta.connection.lastSyncAt)}</small>}</div>
      {accounts.length > 0 && <details className="connected-accounts"><summary>View connected ad accounts <Icon name="chevron" size={15} /></summary><div className="account-details">{accounts.map((account) => <span key={account.id}><strong>{account.name}{account.selected && <span className="account-selected"><Icon name="check" size={12} /> Selected</span>}</strong><small>{account.externalId} · {account.currency || "Currency unavailable"}</small></span>)}</div></details>}
      {!accounts.length && <p className="muted-copy">{connected ? "Sync your account to discover available campaigns." : "Connect Meta Ads to bring your campaigns into SteadySignal."}</p>}
      <div className="settings-actions">{connected ? <>
        <Button icon="refresh" onClick={syncMeta} disabled={busy === "sync" || busy === "meta-accounts"}>{busy === "sync" ? "Syncing…" : accounts.length ? "Refresh accounts" : "Discover ad accounts"}</Button>
        <Button icon="link" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Reconnect</Button><Button className="destructive-text" onClick={disconnectMeta}>Disconnect</Button>
      </> : <Button kind="primary" icon="link" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}</div>
      {meta.connection?.lastError && <div className="alert error">{meta.connection.lastError}</div>}
    </section>
    <div className="settings-grid">
      <section className="panel settings-monitoring"><span className="settings-section-icon"><Icon name="watch" size={22} /></span><h2>Campaign monitoring</h2><p>Fresh campaign details and destination checks, automatically.</p><div className="setting-line"><span>Check interval</span><strong>Every minute</strong></div><div className="setting-line"><span>Campaigns on watch</span><strong>{campaigns.filter((item) => item.monitoringEnabled).length} active</strong></div><a className="text-link" href="#/site-watch">Manage campaign watches <Icon name="arrow" size={15} /></a></section>
      <form className="panel settings-notifications" onSubmit={savePreferences}><span className="settings-section-icon"><Icon name="mail" size={22} /></span><h2>Stay in the loop</h2><p>Choose which campaign updates reach your inbox.</p>
        <label className="form-label">Notification email<input type="email" name="email" required maxLength="254" defaultValue={preferences.email} /></label>
        <label className="toggle-row"><span><strong>New incidents</strong><small>When a monitored page changes or fails.</small></span><input type="checkbox" name="incidentAlertsEnabled" defaultChecked={preferences.incidentAlertsEnabled} aria-label="Email me about new incidents" /></label>
        <label className="toggle-row"><span><strong>Recovery updates</strong><small>When a new check verifies recovery.</small></span><input type="checkbox" name="recoveryAlertsEnabled" defaultChecked={preferences.recoveryAlertsEnabled} aria-label="Email me about recovery updates" /></label>
        <label className="toggle-row"><span><strong>Pause campaigns when a landing page is down</strong><small>Pauses active campaigns after two consecutive failed checks. If email delivery is enabled, a confirmation is sent to {preferences.email}. {canPauseMetaCampaigns ? "" : "Reconnect Meta Ads and grant ads_management access."}</small></span><input type="checkbox" name="autoPauseCampaignOnWebsiteDown" defaultChecked={preferences.autoPauseCampaignOnWebsiteDown} aria-label="Automatically pause campaigns after repeated landing page failures" /></label>
        <Button kind="primary" type="submit" disabled={busy === "preferences"}>{busy === "preferences" ? "Saving…" : "Save preferences"}</Button>
      </form>
    </div>
    <p className="security-note"><Icon name="shield" size={15} /> Your Meta connection is encrypted. SteadySignal never publishes ads.</p>
  </>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
