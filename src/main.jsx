import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { campaignPhase, formatDate, statusTone, valueText } from "./domain.js";
import { Icon } from "./icons.jsx";
import { Brand } from "./Brand.jsx";
import { LandingPage } from "./LandingPage.jsx";
import { AccountSettings, MetaConnectionNotice, RecoveryPage } from "./AccountAccess.jsx";
import { BillingPage, BillingNotice } from "./Billing.jsx";
import { resolveRoute } from "./routes.js";
import { watchSessionActivity } from "./session.js";
import { AnalyticsConsent } from "./AnalyticsConsent.jsx";
import { recordReportView } from "./analytics.js";
import { INCIDENT_REPORT_LIMIT, INCIDENT_TYPES, groupIncidents, incidentReportHref, incidentType, incidentTypeLabel, incidentValueText } from "./incidents.js";
import "./styles.css";
import "./overview.css";

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
    let fallbackDetail = "";
    try {
      const body = await response.json();
      detail = body.code || body.message || "";
      fallbackDetail = body.message || "";
    } catch {
      detail = "";
    }
    const errorCode = detail;
    detail = ({
      ANALYSIS_LIMIT_REACHED: "This campaign needs more analyses than you have available. Review Plan & usage to upgrade or add analyses.",
      MONITORED_PAGE_LIMIT_REACHED: "This watch would exceed your landing-page allowance. Free a slot or upgrade in Plan & usage.",
      AD_ACCOUNT_LIMIT_REACHED: "Your plan does not cover this many Meta accounts. Select fewer accounts or upgrade in Plan & usage.",
      TRIAL_EXPIRED: "Your monitoring trial has ended. Choose a plan in Plan & usage to resume your watches.",
      MONITORING_NOT_ENABLED: "Start a watch for this campaign before requesting a monitoring recheck.",
      BILLING_NOT_CONFIGURED: "Paid checkout is not available yet. Contact your workspace administrator.",
      STRIPE_REQUEST_FAILED: "Stripe could not complete this request. Try again or contact your workspace administrator.",
      STRIPE_UNAVAILABLE: "Stripe is temporarily unavailable. Your current plan has not changed; try again shortly.",
      SUBSCRIPTION_REQUIRED: "Choose a paid plan before purchasing additional analyses.",
      INTENTIONAL_SETTING_NOT_ACTIVE: "This incident type is already using normal monitoring. Refresh to see its current status.",
      META_ADS_MANAGEMENT_REQUIRED: "Reconnect Meta Ads and grant the ads_management permission to enable automatic pausing.",
      AUTO_PAUSE_BETA_ACKNOWLEDGEMENT_REQUIRED: "Review and accept the beta warning before enabling automatic pausing.",
      META_PERMISSION_DENIED: "Meta did not grant the permission required to pause campaigns. Reconnect Meta Ads and approve the requested access.",
      EMAIL_VERIFICATION_NOT_CONFIGURED: "Email sign-up is not enabled yet. Configure SMTP and enable email verification, or sign up with Google.",
      EMAIL_DELIVERY_FAILED: "We could not send the verification email. Check the SMTP settings and try again.",
      EMAIL_NOT_VERIFIED: "Verify your email using the link we sent before signing in.",
      EMAIL_ALREADY_REGISTERED: "An account already uses this email. Sign in instead.",
      GOOGLE_NOT_CONFIGURED: "Google sign-in is not configured on the backend yet.",
      ACCOUNT_RECOVERY_NOT_CONFIGURED: "Recovery email is currently unavailable. Contact your workspace administrator.",
      INVALID_OR_EXPIRED_RESET: "This password reset link is invalid, expired, or already used. Request a new link.",
      INVALID_OR_EXPIRED_DELETION: "This deletion link is invalid, expired, or already used. Request a new confirmation email in settings.",
      CURRENT_PASSWORD_INCORRECT: "Your current password was not accepted.",
      PASSWORD_NOT_SET: "Use a password setup email to add a password to your account.",
      PASSWORD_UNCHANGED: "Choose a password different from your current password.",
      PASSWORD_POLICY: "Use a password with 8 to 200 characters.",
      META_TOKEN_EXPIRED: "Meta access has expired. Reconnect Meta Ads in settings.",
      META_RECONNECT_REQUIRED: "Reconnect Meta Ads in settings to restore access.",
      RATE_LIMITED: "Too many requests. Wait a minute and try again.",
      GOOGLE_ACCOUNT_NOT_AUTHORIZED: "No account uses that Google email yet. Switch to sign up to create a workspace."
    })[detail] || fallbackDetail || detail;
    const error = new Error(detail || `Request failed (${response.status})`);
    error.code = errorCode;
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
  return resolveRoute(window.location.hash, window.location.search);
}

function navigate(path) {
  window.location.hash = `/${path}`;
}

function Button({ children, icon, kind = "secondary", className = "", ...props }) {
  return <button className={`button ${kind} ${className}`} {...props}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

function Status({ value, label }) {
  const raw = label || value || "Not checked";
  const text = ({ STALE: "Out of date", PASS: "Passed", FAIL: "Needs action", WARNING: "Review needed", UNKNOWN: "Not checked", OPEN: "Open", CONNECTED: "Connected", RESOLVED: "Resolved", INTENTIONAL: "Intentional", REVERTED: "Reverted" })[raw] || metaCodeLabel(raw);
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
    return { ssoError: params.get("sso_error"), emailVerified: params.get("email_verified") };
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
  const [passwordRecoveryEnabled, setPasswordRecoveryEnabled] = useState(null);
  const [authMode, setAuthMode] = useState(() => routeFromHash().page === "signup" ? "signup" : "signin");
  const [authEmail, setAuthEmail] = useState("");
  const [canResendVerification, setCanResendVerification] = useState(false);
  const [route, setRoute] = useState(routeFromHash);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [qaConfirmation, setQaConfirmation] = useState(null);
  const [incidentDecision, setIncidentDecision] = useState(null);
  const [toast, setToast] = useState("");
  const authGeneration = useRef(0);
  const intentHandled = useRef(false);
  useEffect(() => {
    if (route.plan) { try { window.sessionStorage.setItem("steadysignal_plan", route.plan); } catch {} }
    if (auth === "signed-in" && data && !intentHandled.current && ["overview", "login", "signup"].includes(route.page)) {
      let intent = route.plan; try { intent ||= window.sessionStorage.getItem("steadysignal_plan"); } catch {}
      intentHandled.current = true;
      if (["STARTER", "GROWTH", "AGENCY"].includes(intent)) {
        try { window.sessionStorage.removeItem("steadysignal_plan"); } catch {}
        navigate(`billing?plan=${intent}`);
      }
    }
  }, [route.plan, route.page, auth, data]);

  const loadApp = useCallback(async () => {
    const generation = authGeneration.current;
    setLoadError("");
    const [me, dashboard, meta, campaigns, incidents, preferences, billing] = await Promise.all([
      request("/api/me"),
      request("/api/dashboard"),
      request("/api/integrations/meta/status"),
      request("/api/campaigns"),
      request("/api/incidents"),
      request("/api/notification-preferences"),
      request("/api/billing")
    ]);
    if (generation !== authGeneration.current) return;
    setUser(me);
    setData({ dashboard, meta, campaigns, incidents, preferences, billing });
    setAuth("signed-in");
  }, []);

  useEffect(() => {
    if (authCallback.ssoError || authCallback.emailVerified) {
      window.history.replaceState(null, "", `${window.location.pathname}#/login`);
    }
  }, [authCallback]);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    request("/api/auth/google/status")
      .then((result) => {
        setGoogleEnabled(Boolean(result.enabled));
        setEmailSignupEnabled(Boolean(result.emailSignupEnabled));
        setPasswordRecoveryEnabled(Boolean(result.passwordRecoveryEnabled));
      })
      .catch(() => { setGoogleEnabled(false); setPasswordRecoveryEnabled(false); });
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
    if (auth !== "signed-in") return undefined;
    const refreshConnection = () => {
      if (document.visibilityState === "hidden") return;
      request("/api/billing").then((billing) => setData((current) => current ? { ...current, billing } : current)).catch(() => {});
      request("/api/integrations/meta/status").then((meta) => setData((current) => current ? { ...current, meta } : current)).catch(() => {});
    };
    const timer = window.setInterval(refreshConnection, 60000);
    window.addEventListener("focus", refreshConnection);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refreshConnection); };
  }, [auth]);

  useEffect(() => {
    if (route.page === "login" || route.page === "signup") {
      setAuthMode(route.page === "signup" ? "signup" : "signin");
      if (auth === "signed-in") navigate("overview");
    }
  }, [route.page, auth]);

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
      setCanResendVerification(error.code === "EMAIL_NOT_VERIFIED");
      setLoginError(error.code === "INVALID_CREDENTIALS" ? "Email or password was not accepted." : error.message);
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
    window.location.assign(`/api/auth/google/start?${params.toString()}`);
  };

  const logout = async () => {
    setBusy("logout");
    setLoadError("");
    try {
      await request("/api/auth/logout", { method: "POST" });
      authGeneration.current += 1;
      setUser(null);
      setData(null);
      setAuth("signed-out");
      navigate("login");
    } catch (error) {
      if (error.status === 401) {
        authGeneration.current += 1;
        setUser(null);
        setData(null);
        setAuth("signed-out");
        navigate("login");
      } else {
        setLoadError(`Could not sign out: ${error.message}`);
      }
    } finally {
      setBusy("");
    }
  };

  const accountSignedOut = useCallback((notice) => {
    authGeneration.current += 1;
    setUser(null);
    setData(null);
    setAuth("signed-out");
    setLoadError("");
    setLoginError("");
    setLoginNotice(notice);
    navigate("login");
  }, []);

  useEffect(() => {
    if (auth !== "signed-in") return undefined;
    const generation = authGeneration.current;
    return watchSessionActivity({
      renew: (signal) => request("/api/auth/activity", { method: "POST", signal }),
      onExpired: () => {
        if (generation === authGeneration.current) accountSignedOut("Your session expired. Sign in again.");
      }
    });
  }, [auth, accountSignedOut]);

  const runQa = async (campaignId) => {
    setBusy(`estimate:${campaignId}`); setLoadError("");
    try { const estimate = await request(`/api/campaigns/${campaignId}/qa-estimate`); setQaConfirmation({ campaignId, ...estimate }); }
    catch (error) { setLoadError(error.message); }
    finally { setBusy(""); }
  };

  const executeQa = async (campaignId) => {
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

  const saveAutomaticPausing = async (enabled) => {
    setBusy("auto-pause");
    setLoadError("");
    try {
      const preferences = await request("/api/notification-preferences", {
        method: "PATCH",
        body: {
          email: data.preferences.email,
          incidentAlertsEnabled: data.preferences.incidentAlertsEnabled,
          recoveryAlertsEnabled: data.preferences.recoveryAlertsEnabled,
          autoPauseCampaignOnWebsiteDown: enabled,
          autoPauseBetaAcknowledged: enabled
        }
      });
      setData((current) => current ? { ...current, preferences } : current);
      setToast(enabled ? "Automatic pausing enabled (beta)." : "Automatic pausing disabled. Paused campaigns can be restarted in Meta Ads.");
      return { ok: true };
    } catch (error) {
      setLoadError(error.message);
      return { ok: false, message: error.message };
    } finally {
      setBusy("");
    }
  };

  const performIncidentAction = async (incident, action) => {
    setBusy(`incident:${incident.id}`);
    setLoadError("");
    setToast("");
    let reverted = false;
    try {
      const result = await request(`/api/incidents/${incident.id}/${action}`, {
        method: "POST",
        ...(action === "mark-intentional" ? { body: { note: "Marked intentional until explicitly reverted by a workspace member." } } : {})
      });
      if (action === "revert-intentional" && result?.recheckQueued === false) {
        await reload(); setToast("Intentional setting reverted. Resume monitoring coverage to request a fresh inspection."); return;
      }
      if (action === "revert-intentional") {
        reverted = true;
        await reload();
        setToast("Normal monitoring restored. A fresh inspection is running.");
      }
      if (action !== "mark-intentional" && result?.id) {
        const complete = await waitFor("/api/jobs", result.id);
        if (complete.status === "FAILED") throw new Error(complete.errorMessage || "The incident check failed.");
      }
      await reload();
      setToast(action === "mark-intentional"
        ? "This incident type will stay intentional until you revert it."
        : action === "revert-intentional"
          ? "Normal monitoring restored. A fresh inspection has completed."
          : "Fresh inspection completed. Incident status reflects the verified result.");
    } catch (error) {
      setLoadError(reverted ? `Normal monitoring was restored, but the fresh result could not be loaded: ${error.message}` : error.message);
    } finally {
      setBusy("");
    }
  };

  const actOnIncident = (incident, action) => {
    if (action === "mark-intentional") setIncidentDecision(incident);
    else performIncidentAction(incident, action);
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
  if (["forgot-password", "reset-password"].includes(route.page) || (route.page === "delete-account" && auth === "signed-in")) {
    return <RecoveryPage key={`${route.page}:${route.token || ""}`} mode={route.page} token={route.token} request={request} enabled={passwordRecoveryEnabled} account={user} onSignedOut={accountSignedOut} />;
  }
  if (auth === "signed-out") {
    return <main className="login-page"><aside className="login-story"><a href="/" className="login-brand" aria-label="Click Cohere home"><Brand /></a><div className="login-story-copy"><div className="health-kicker">EVERY CLICK, CONNECTED</div><h2>Confidence before <br />every click.</h2><p>From your first campaign check to the pages already live. Stay one step ahead of what needs your attention.</p><div className="auth-diagram" aria-hidden="true"><div><Icon name="campaigns" size={27} /><span>Your campaign</span></div><span className="diagram-connector" /><div className="diagram-center"><Icon name="shield" size={35} /><span>Click Cohere</span></div><span className="diagram-connector" /><div><Icon name="globe" size={27} /><span>Landing page</span></div></div></div><div className="login-story-foot"><Icon name="shield" size={16} /> Your ad. Your page. One connected story.</div></aside><div className="login-form-region"><section className="login-card">
      <div className="eyebrow">YOUR CAMPAIGN WORKSPACE</div><h1>{authMode === "signup" ? "Make room for clarity." : "Welcome back."}</h1><p>{authMode === "signup" ? "Start with 10 ad analyses and a 14-day monitoring preview. No credit card required." : "Sign in and see how your campaigns are doing."}</p>
      {loadError && <div className="alert error" role="alert">{loadError} Check that the backend is running, then try again.</div>}
      {loginError && <div className="alert error" role="alert">{loginError}</div>}
      {loginNotice && <div className="alert success" role="status">{loginNotice}</div>}
      {route.page === "delete-account" && <div className="alert" role="status">Sign in to the account you requested to delete. If you use Google, reopen the link in your deletion email after signing in.</div>}
      {authMode === "signup" && !emailSignupEnabled && <div className="alert" role="status">{googleEnabled ? "Email registration is currently unavailable. Continue with Google to create your workspace." : "Email registration is currently unavailable. Contact your workspace administrator."}</div>}
      {authMode === "signup" && <p className="signup-policies">By creating an account, including with Google, you agree to the <a href="/terms.html" target="_blank" rel="noopener">Terms</a>. Read our <a href="/privacy.html" target="_blank" rel="noopener">Privacy notice</a> and <a href="/refunds.html" target="_blank" rel="noopener">Refunds &amp; cancellation policy</a>.</p>}
      {googleEnabled && <>
        <Button type="button" className="google-button" onClick={startGoogleAuth}>
          <span className="google-g" aria-hidden="true">G</span>{authMode === "signup" ? "Sign up with Google" : "Sign in with Google"}
        </Button>
        <div className="login-divider"><span>or continue with email</span></div>
      </>}
      <form key={authMode} onSubmit={login} className="form-stack">
        {authMode === "signup" && <>
          <label>Your name<input type="text" name="name" autoComplete="name" required maxLength="80" /></label>
          <label>Workspace name<input type="text" name="workspaceName" autoComplete="organization" required minLength="2" maxLength="80" /></label>
        </>}
        <label>Email address<input type="email" name="email" autoComplete="email" required maxLength="254" value={authEmail} onChange={(event) => { setAuthEmail(event.target.value); setCanResendVerification(false); }} /></label>
        <label>Password<input type="password" name="password" autoComplete={authMode === "signup" ? "new-password" : "current-password"} required minLength={authMode === "signup" ? 8 : undefined} maxLength="200" /></label>
        {authMode === "signup" && <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" required minLength="8" maxLength="200" /></label>}
        <Button kind="primary" type="submit" disabled={loginBusy || (authMode === "signup" && !emailSignupEnabled)}>{loginBusy ? (authMode === "signup" ? "Creating account…" : "Signing in…") : (authMode === "signup" ? "Create account" : "Sign in")}</Button>
      </form><p className="fine-print"><Icon name="shield" size={13} />{authMode === "signup" ? "Use at least 8 characters. We'll verify your email." : "A secure space for your campaign work."}</p>
      {authMode === "signin" && canResendVerification && <Button type="button" className="resend-verification" disabled={loginBusy || !authEmail.trim()} onClick={resendVerification}>Resend verification email</Button>}
      {authMode === "signin" && <p className="forgot-password-link"><a className="text-link" href="#/forgot-password">Forgot password?</a></p>}
      <p className="auth-switch">{authMode === "signup" ? "Already have an account?" : "New to Click Cohere?"} <a className="text-button" href={authMode === "signup" ? "#/login" : "#/signup"} onClick={() => setLoginError("")}>{authMode === "signup" ? "Sign in" : "Create an account"}</a></p>
    </section><p className="login-form-foot">Click Cohere · Campaign assurance, made clear.</p></div></main>;
  }
  if (route.page === "login" || route.page === "signup") return <main className="center-state"><div className="spinner" /><p>Opening your workspace…</p></main>;
  if (!data) return <main className="center-state"><div className="spinner" /><p>Loading workspace data…</p>{loadError && <p role="alert">{loadError} <button className="text-button" onClick={reload}>Try again</button></p>}</main>;

  const connection = data.meta?.connection;
  const connected = connection?.status === "CONNECTED";
  const lastSync = connection?.lastSyncAt ? new Date(connection.lastSyncAt).getTime() : null;
  const metaSyncIsStale = connected && lastSync && Date.now() - lastSync > 24 * 60 * 60 * 1000;
  const activeNav = route.page === "report" ? "campaigns" : route.page;

  return <div className="app-shell">
    {qaConfirmation && <AnalysisConfirmation estimate={qaConfirmation} onCancel={() => setQaConfirmation(null)} onConfirm={() => { const id = qaConfirmation.campaignId; setQaConfirmation(null); executeQa(id); }} />}
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
    <aside className="sidebar">
      <a href="#/overview" className="brand-link" aria-label="Click Cohere overview"><Brand /></a>
      <div className="workspace-card"><span className="workspace-monogram">{(user?.workspace?.name || "W").slice(0, 1).toUpperCase()}</span><span><strong>{user?.workspace?.name || "My workspace"}</strong><small>Campaign workspace</small></span></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <NavItem id="overview" active={activeNav === "overview"} icon="overview" label="Overview" />
        <NavItem id="campaigns" active={activeNav === "campaigns"} icon="campaigns" label="Campaigns" count={data.campaigns.length} />
        <NavItem id="site-watch" active={activeNav === "site-watch"} icon="watch" label="Campaign watch" count={data.campaigns.filter((item) => item.monitoringEnabled).length} />
        <NavItem id="incidents" active={activeNav === "incidents"} icon="warning" label="Incident report" />
        <NavItem id="billing" active={activeNav === "billing"} icon="shield" label="Plan & usage" />
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
        <div className="breadcrumbs"><Icon name={activeNav === "site-watch" ? "watch" : activeNav === "incidents" ? "warning" : activeNav} size={17} /><span>Workspace</span><Icon name="chevron" size={12} /><strong>{route.page === "report" ? "QA report" : route.page === "site-watch" ? "Campaign watch" : route.page === "incidents" ? "Incident report" : route.page[0].toUpperCase() + route.page.slice(1)}</strong></div>
        <div className="topbar-right"><span className="workspace-date"><Icon name="calendar" size={15} />{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date())}</span><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? "Meta connected" : "Meta disconnected"} /><button className="icon-button mobile-signout" title="Sign out" aria-label="Sign out" onClick={logout} disabled={busy === "logout"}><Icon name="logout" size={17} /></button></div>
      </header>
      <div className={`page-content page-${route.page}`} id="main-content" tabIndex="-1">
        {!connection && <div className="alert connection-alert" role="status"><div><strong>Meta account disconnected</strong><span>Connect Meta to import real campaigns and run prelaunch QA.</span></div><Button kind="primary" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button></div>}
        <BillingNotice billing={data.billing} />
        <MetaConnectionNotice meta={data.meta} />
        {route.metaError === "denied" && <div className="alert" role="status">Meta authorization was not completed. Choose Reconnect when you are ready to grant access.</div>}
        {connection?.lastError && <div className="alert error" role="alert">Meta reports: {connection.lastError}. Reconnect or review the account configuration.</div>}
        {metaSyncIsStale && <div className="alert stale-alert" role="status">Meta campaign data was last synced {formatDate(connection.lastSyncAt)}. Sync now before relying on campaign status.</div>}
        {loadError && <div className="alert error" role="alert"><span>{loadError}</span><button className="alert-close" aria-label="Dismiss error" onClick={() => setLoadError("")}>×</button></div>}
        {route.page === "billing" && <BillingPage billing={data.billing} request={request} reload={reload} route={route} />}
        {route.page === "overview" && <Overview data={data} busy={busy} runQa={runQa} syncMeta={syncMeta} />}
        {route.page === "campaigns" && <Campaigns data={data} busy={busy} runQa={runQa} monitorCampaign={monitorCampaign} syncMeta={syncMeta} selectMetaAccounts={saveMetaAccounts} />}
        {route.page === "report" && <QaReport campaignId={route.id} refreshKey={data.campaigns?.find((item) => item.campaign?.id === route.id)?.lastQa?.id || ""} runQa={runQa} busy={busy} />}
        {route.page === "site-watch" && <SiteWatch data={data} selectedCampaignId={route.campaignId} busy={busy} checkCampaign={checkCampaign} monitorCampaign={monitorCampaign} actOnIncident={actOnIncident} />}
        {route.page === "incidents" && <IncidentReport data={data} route={route} busy={busy} actOnIncident={actOnIncident} />}
        {route.page === "settings" && <Settings data={data} account={user} onSignedOut={accountSignedOut} busy={busy} syncMeta={syncMeta} disconnectMeta={disconnectMeta} savePreferences={savePreferences} saveAutomaticPausing={saveAutomaticPausing} />}
      </div>
      <footer className="workspace-footer"><span>Click Cohere <span aria-hidden="true">/</span> Campaign assurance</span><span><Icon name="shield" size={13} /> Your campaigns. A clearer picture.</span></footer>
      {toast && <div className="toast" role="status">{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification">×</button></div>}
    </main>
    {incidentDecision && <IncidentDecisionDialog incident={incidentDecision} campaignName={data.campaigns.find((item) => item.campaign.id === incidentDecision.campaignId)?.campaign.name} onCancel={() => setIncidentDecision(null)} onConfirm={() => {
      const incident = incidentDecision;
      setIncidentDecision(null);
      performIncidentAction(incident, "mark-intentional");
    }} />}
  </div>;
}

function IncidentDecisionDialog({ incident, campaignName, onCancel, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current.showModal();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  const scope = incident.campaignId
    ? `the campaign “${campaignName || incident.campaignId.slice(0, 8)}”`
    : "this page";
  return <dialog ref={dialog} className="incident-decision-dialog" aria-labelledby="incident-decision-title" aria-describedby="incident-decision-description" onCancel={(event) => { event.preventDefault(); onCancel(); }} onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <div className="incident-decision-content">
      <span className="eyebrow">CAMPAIGN MONITORING</span>
      <h2 id="incident-decision-title">Mark {incidentTypeLabel(incident.type).toLowerCase()} intentional?</h2>
      <div id="incident-decision-description">
        <p>This applies to all current and future incidents of this type for {scope}{incident.campaignId ? ", across all its destination pages" : ""}.</p>
        <p><strong>It stays intentional until someone explicitly reverts it.</strong> Future checks will still record what they observe, but incidents of this type will not open alerts.</p>
        {incident.campaignId && incident.type === "availability" && <p className="incident-decision-warning">Automatic campaign pausing for page availability failures will also be disabled until this setting is reverted.</p>}
        <p>Use <strong>Revert intentional</strong> in the campaign summary or incident report to restore normal monitoring.</p>
      </div>
      <div className="incident-decision-actions"><Button autoFocus onClick={onCancel}>Cancel</Button><Button kind="primary" onClick={onConfirm}>Mark intentional</Button></div>
    </div>
  </dialog>;
}

function NavItem({ id, active, icon, label, count }) {
  return <a className={`nav-item ${active ? "active" : ""}`} href={`#/${id}`} aria-current={active ? "page" : undefined} title={label}><Icon name={icon} size={19} /><span className="nav-label">{label}</span>{count != null && <span className="nav-count">{count}</span>}</a>;
}

function Overview({ data, busy, runQa, syncMeta }) {
  const { campaigns = [], incidents = [], meta = {} } = data;
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(4);
  const attention = useRef(null);
  const connected = meta.connection?.status === "CONNECTED";
  const needsReview = campaigns.filter((item) => {
    const status = String(item.qaState || item.verdict || "UNKNOWN").toUpperCase();
    const campaign = item.campaign || {};
    return campaignPhase(campaign) !== "Live" && (!item.lastQa || ["FAIL", "WARNING", "STALE", "UNKNOWN", "NOT CHECKED"].includes(status));
  }).sort((a, b) => {
    const priority = { FAIL: 0, WARNING: 1, STALE: 2, UNKNOWN: 3 };
    return (priority[String(a.qaState || a.verdict).toUpperCase()] ?? 3) - (priority[String(b.qaState || b.verdict).toUpperCase()] ?? 3);
  });
  const monitored = campaigns.filter((item) => item.monitoringEnabled);
  const openIncidents = incidents.filter((incident) => incident.status === "OPEN").sort((a, b) =>
    Number(b.type === "availability") - Number(a.type === "availability") ||
    (Date.parse(b.lastSeenAt || b.createdAt) || 0) - (Date.parse(a.lastSeenAt || a.createdAt) || 0)
  );
  const campaignById = new Map(campaigns.map((item) => [item.campaign.id, item]));
  const incidentsByCampaign = new Map();
  for (const incident of openIncidents) {
    if (!incidentsByCampaign.has(incident.campaignId)) incidentsByCampaign.set(incident.campaignId, incident);
  }
  const watchPreview = [...monitored].sort((a, b) =>
    Number(incidentsByCampaign.has(b.campaign.id)) - Number(incidentsByCampaign.has(a.campaign.id))
  ).slice(0, 4);
  const selectedAccounts = meta.accounts?.filter((account) => account.selected).length || 0;
  const coverage = campaigns.length ? Math.round(monitored.length / campaigns.length * 100) : 0;
  const allActions = [
    ...openIncidents.map((incident) => ({ type: "incident", id: `incident:${incident.id}`, incident })),
    ...needsReview.map((item) => ({ type: "qa", id: `qa:${item.campaign.id}`, item }))
  ];
  const actions = allActions.filter((action) => filter === "all" || action.type === filter);
  const selectFilter = (value, focus = false) => {
    setFilter(value);
    setVisibleCount(4);
    if (focus) {
      attention.current?.focus({ preventScroll: true });
      attention.current?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  };

  return <>
    <div className="overview-heading">
      <div><div className="eyebrow">YOUR WORKSPACE</div><h1>Overview<span className="overview-title-dot">.</span></h1><p>Your campaigns and next steps, at a glance.</p></div>
      <div className="overview-signal-art" aria-hidden="true">
        <svg viewBox="0 0 340 132" fill="none" focusable="false">
          <g className="overview-signal-guides"><path d="M12 66h316M242 5v122" /><circle cx="242" cy="66" r="57" /><circle cx="242" cy="66" r="38" /><circle cx="242" cy="66" r="19" /></g>
          <path className="overview-signal-trace" d="M18 66h104l12-19 17 40 20-63 23 84 18-42h87" />
          <circle className="overview-signal-node" cx="299" cy="66" r="4" /><circle className="overview-signal-orbit" cx="242" cy="9" r="3" />
        </svg>
      </div>
      {connected
        ? <Button className="overview-sync" icon="refresh" onClick={syncMeta} disabled={Boolean(busy)}>{busy === "sync" ? "Syncing campaigns…" : "Sync campaigns"}</Button>
        : <Button kind="primary" icon="link" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}
    </div>

    <section className="overview-metrics" aria-label="Workspace summary">
      <OverviewMetric label="Campaigns" value={campaigns.length} note={selectedAccounts ? `Across ${selectedAccounts} ad account${selectedAccounts === 1 ? "" : "s"}` : "Your imported campaigns"} icon="campaigns" tone="total" href="#/campaigns" />
      <OverviewMetric label="To review" value={needsReview.length} note="Before your next launch" icon="shield" tone={needsReview.length ? "review" : ""} onClick={() => selectFilter("qa", true)} />
      <OverviewMetric label="Watches enabled" value={monitored.length} note={data.billing.monitoringActive ? `${data.billing.monitoringIntervalMinutes}-minute schedule` : "Coverage paused ? review your plan"} icon="watch" tone="watch" href="#/site-watch" />
      <OverviewMetric label="Open incidents" value={openIncidents.length} note={openIncidents.length ? "Landing-page issues to review" : "No open issues"} icon="warning" tone={openIncidents.length ? "incident" : ""} onClick={() => selectFilter("incident", true)} />
    </section>

    <div className="overview-workspace">
      <section className="overview-panel overview-attention" ref={attention} tabIndex="-1" id="overview-attention" aria-labelledby="overview-attention-title">
        <div className="overview-panel-heading"><div><h2 id="overview-attention-title">Needs attention<span className="overview-count">{allActions.length}</span></h2><p>Open incidents first. Campaign checks next.</p></div></div>
        <div className="overview-filters" role="group" aria-label="Filter actions">
          {[{ id: "all", label: "All", count: allActions.length }, { id: "incident", label: "Incidents", count: openIncidents.length }, { id: "qa", label: "QA checks", count: needsReview.length }].map((option) =>
            <button key={option.id} type="button" className={`overview-filter ${filter === option.id ? "is-active" : ""}`} aria-pressed={filter === option.id} aria-controls="overview-action-list" onClick={() => selectFilter(option.id)}>{option.label}<span>{option.count}</span></button>
          )}
        </div>
        <div id="overview-action-list">
          {actions.length ? <ul className="overview-action-list">{actions.slice(0, visibleCount).map((action) => action.type === "incident"
            ? <OverviewIncidentRow key={action.id} incident={action.incident} campaignName={campaignById.get(action.incident.campaignId)?.campaign.name} />
            : <OverviewQaRow key={action.id} item={action.item} busy={busy} runQa={runQa} />
          )}</ul> : <div className="overview-empty"><span><Icon name={campaigns.length ? "check" : "campaigns"} size={24} /></span><h3>{!campaigns.length && !allActions.length ? "Your workspace starts here" : filter === "incident" ? "No open incidents" : filter === "qa" ? "No campaigns need review" : "You're all caught up"}</h3><p>{!campaigns.length && !allActions.length ? connected ? "Sync your Meta campaigns to run your first check." : "Connect Meta Ads to bring your campaigns into view." : filter === "incident" ? "Any new landing-page issues will appear here." : "Your next action will appear here when it's needed."}</p></div>}
        </div>
        {actions.length > 0 && <div className="overview-panel-footer"><span aria-live="polite">Showing {Math.min(visibleCount, actions.length)} of {actions.length}</span>{actions.length > visibleCount ? <button type="button" className="text-link overview-show-more" onClick={() => setVisibleCount((count) => count + 4)}>Show more <Icon name="chevron" size={14} /></button> : <a className="text-link" href={filter === "incident" ? incidentReportHref({ status: "OPEN" }) : "#/campaigns"}>{filter === "incident" ? "Incident report" : "All campaigns"}<Icon name="arrow" size={14} /></a>}</div>}
      </section>

      <section className="overview-panel overview-monitoring" aria-labelledby="overview-watch-title">
        <div className="overview-panel-heading"><div><h2 id="overview-watch-title">Campaign watch</h2><p>Landing pages, checked around the clock.</p></div><span className={`overview-live ${monitored.length ? "is-live" : ""}`}><span className={`signal-dot ${monitored.length ? "online" : ""}`} />{monitored.length ? "Live" : "Inactive"}</span></div>
        <div className="overview-coverage"><div><span>Monitoring coverage</span><strong>{coverage}<span>%</span></strong></div><div className="overview-coverage-track" role="meter" aria-label="Campaigns on watch" aria-valuenow={monitored.length} aria-valuemin={0} aria-valuemax={campaigns.length || 1} aria-valuetext={`${monitored.length} of ${campaigns.length} campaigns on watch`}><span style={{ width: `${coverage}%` }} /></div><p><strong>{monitored.length}</strong> of {campaigns.length} campaigns on watch</p></div>
        {monitored.length ? <ul className="overview-watch-list">{watchPreview.map((item) => <OverviewWatchRow key={item.campaign.id} item={item} incident={incidentsByCampaign.get(item.campaign.id)} />)}</ul> : <div className="overview-empty overview-watch-empty"><span><Icon name="watch" size={24} /></span><h3>Start your first watch</h3><p>Monitor a campaign to check its landing pages on your plan's schedule.</p><a className="text-link" href="#/campaigns">Choose campaigns <Icon name="arrow" size={15} /></a></div>}
        <div className="overview-panel-footer"><span><Icon name="clock" size={13} /> Every 60 seconds</span><a className="text-link" href="#/site-watch">{monitored.length > watchPreview.length ? `View all ${monitored.length}` : "Manage watch"}<Icon name="arrow" size={14} /></a></div>
      </section>
    </div>

    <div className="overview-data-note"><Icon name="meta" size={17} /><span>{connected ? meta.connection.lastSyncAt ? <>Last synced from Meta <time dateTime={meta.connection.lastSyncAt}>{formatDate(meta.connection.lastSyncAt)}</time></> : "Connected to Meta. Sync to refresh your campaigns." : "Connect Meta to keep your campaign data in sync."}</span><a href="#/settings">Connection settings<Icon name="arrow" size={12} /></a></div>
  </>;
}

function OverviewMetric({ label, value, note, icon, tone = "", href, onClick }) {
  const Component = href ? "a" : "button";
  return <Component className={`overview-metric ${tone}`} {...(href ? { href } : { type: "button", onClick, "aria-controls": "overview-attention" })}><span className="overview-metric-label">{label}<Icon name={icon} size={17} /></span><strong>{value}<Icon name="arrow" size={19} /></strong><span className="overview-metric-note">{note}</span></Component>;
}

function OverviewQaRow({ item, busy, runQa }) {
  const { campaign } = item;
  const state = String(item.qaState || item.verdict || "UNKNOWN").toUpperCase();
  const needsRun = !item.lastQa || ["STALE", "UNKNOWN", "NOT CHECKED"].includes(state);
  const checking = busy === `qa:${campaign.id}`;
  return <li className="overview-action-row"><span className="overview-avatar" aria-hidden="true">{(campaign.name || "C").slice(0, 1).toUpperCase()}</span><div className="overview-row-copy"><a href={`#/report/${campaign.id}`}>{campaign.name}</a><div className="overview-row-meta"><span>{campaignObjective(campaign.objective)} · {item.adCount ?? 0} ad{item.adCount === 1 ? "" : "s"}</span><Status value={state} /></div></div>{needsRun ? <Button className="overview-row-action" onClick={() => runQa(campaign.id)} disabled={Boolean(busy)} aria-label={`${checking ? "Checking" : "Run check for"} ${campaign.name}`}>{checking ? "Checking…" : "Run check"}<Icon name={checking ? "refresh" : "arrow"} size={14} /></Button> : <a className="button overview-row-action" href={`#/report/${campaign.id}`} aria-label={`View report for ${campaign.name}`}>View report<Icon name="arrow" size={14} /></a>}</li>;
}

function OverviewIncidentRow({ incident, campaignName }) {
  const href = incidentReportHref({ campaignId: incident.campaignId || "", type: incidentType(incident.type), status: "OPEN" });
  return <li className="overview-action-row overview-incident-row"><span className="overview-avatar overview-incident-avatar"><Icon name="warning" size={18} /></span><div className="overview-row-copy"><a href={href}>{campaignName || "Landing page issue"}</a><div className="overview-row-meta"><span>{incidentTypeLabel(incident.type)}</span><span className="overview-incident-label">Open incident</span></div></div><a className="button overview-row-action overview-review-issue" href={href} aria-label={`Review ${incidentTypeLabel(incident.type).toLowerCase()}${campaignName ? ` for ${campaignName}` : ""}`}>Review issue<Icon name="arrow" size={14} /></a></li>;
}

function OverviewWatchRow({ item, incident }) {
  const checked = Boolean(item.lastMonitoringAt);
  const checkedToday = checked && new Date(item.lastMonitoringAt).toDateString() === new Date().toDateString();
  const href = incident ? incidentReportHref({ campaignId: item.campaign.id, status: "OPEN" }) : `#/site-watch?campaign=${encodeURIComponent(item.campaign.id)}`;
  return <li><a className="overview-watch-row" href={href}><span className={`overview-watch-icon ${incident ? "has-incident" : checked ? "is-checked" : ""}`}><Icon name={incident ? "warning" : checked ? "check" : "clock"} size={17} /></span><span className="overview-watch-copy"><strong>{item.campaign.name}</strong><small className={incident ? "has-incident" : ""}>{incident ? "Needs attention" : checked ? <>Last checked <time dateTime={item.lastMonitoringAt}>{formatDate(item.lastMonitoringAt, { dateStyle: checkedToday ? undefined : "medium", timeStyle: "short" })}</time></> : "Waiting for first check"}</small></span><Icon name="chevron" size={14} /></a></li>;
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
    setAccountFilter((current) => current === "__all__" && selectedAccounts.length > 1 ? current
      : selectedAccounts.some((account) => account.externalId === current) ? current
      : selectedAccounts.length > 1 ? "__all__" : selectedAccounts[0]?.externalId || "");
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
    if (filter === "Not running") return phase !== "Live";
    if (filter === "Live") return phase === "Live";
    return true;
  });
  const nonLive = accountCampaigns.filter((item) => campaignPhase(item.campaign) !== "Live");
  const needsAttention = nonLive.filter((item) => !item.lastQa || ["FAIL", "WARNING", "STALE", "UNKNOWN"].includes(item.qaState || item.verdict)).length;
  const changeAccount = (event) => {
    const value = event.target.value;
    setAccountFilter(value);

  };
  return <>
    <PageHeading eyebrow="CAMPAIGN LIBRARY" title="Your campaigns" action={<div className="campaign-heading-actions">{selectedAccounts.length > 0 && <label className="account-filter-label"><span className="sr-only">Ad account</span><select value={accountFilter} onChange={changeAccount} disabled={busy === "sync" || busy === "meta-accounts"}>
      <option value="">Select an ad account</option>
      {accounts.length > 1 && <option value="__all__">All selected accounts</option>}
      {selectedAccounts.map((account) => <option key={account.id} value={account.externalId}>{account.name} ({account.externalId.replace(/^act_/, "")})</option>)}
    </select></label>}<Button kind="primary" icon="refresh" onClick={syncMeta} disabled={!meta.connection || busy === "sync" || busy === "meta-accounts"}>{busy === "sync" ? "Syncing…" : "Sync campaigns"}</Button></div>}>Published campaigns and their destinations, synced from Meta.</PageHeading>
    {accounts.length > 0 && <details className="panel billing-account-picker" open={selectedAccounts.length === 0 ? true : undefined}><summary>Choose accounts to sync <span>{selectedAccounts.length} / {data.billing.adAccounts.limit} selected</span></summary><p>Your plan covers {data.billing.adAccounts.limit} Meta accounts. Allowances are shared across your workspace.</p><div>{accounts.map((a) => <label key={a.id}><input type="checkbox" checked={a.selected} disabled={busy === "meta-accounts" || busy === "sync" || (!a.selected && selectedAccounts.length >= data.billing.adAccounts.limit)} onChange={() => selectMetaAccounts(a.selected ? selectedAccounts.filter((selected) => selected.id !== a.id).map((selected) => selected.externalId) : [...selectedAccounts.map((selected) => selected.externalId), a.externalId])} /><span>{a.name}<small>{a.externalId}</small></span></label>)}</div><a className="text-link" href="#/billing">Review account allowance <Icon name="arrow" size={14} /></a></details>}
    <div className="metrics-grid">
      <Metric label="Awaiting review" value={needsAttention} note="Ready for a fresh campaign check" tone="coral" />
      <Metric label="Not running" value={nonLive.length} note="Paused, scheduled, or otherwise inactive" />
      <Metric label="Currently live" value={accountCampaigns.length - nonLive.length} note="Active campaigns in this ad account" tone="green" />
    </div>
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="filter-tabs" role="group" aria-label="Filter campaigns">{["All campaigns", "Not running", "Live"].map((name) => <button key={name} className={`filter-tab ${filter === name ? "selected" : ""}`} aria-pressed={filter === name} onClick={() => setFilter(name)}>{name}<span>{name === "All campaigns" ? accountCampaigns.length : name === "Not running" ? nonLive.length : accountCampaigns.length - nonLive.length}</span></button>)}</div><label className="search-field"><Icon name="search" size={17} /><span className="sr-only">Search campaigns</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns…" /></label></div>
      {busy === "meta-accounts" ? <div className="center-state inline campaign-loading" role="status" aria-live="polite"><div className="spinner" aria-hidden="true" /><p>Loading campaigns for the selected ad account…</p></div> : rows.length ? <CampaignTable items={rows} busy={busy} runQa={runQa} monitorCampaign={monitorCampaign} /> : <Empty title={accountCampaigns.length ? "No campaigns in this view" : "No campaign data yet"}>{accountCampaigns.length ? "Choose another campaign filter." : meta.connection ? (accounts.length && !accountFilter ? "Choose an account in the account selector above to sync and display its campaigns." : "No published campaigns were returned for this ad account. Publish a campaign with its switch off, then sync again, or choose another account.") : "Connect Meta Ads to import published campaigns."}</Empty>}
      <div className="table-footer"><span>{rows.length} campaign{rows.length === 1 ? "" : "s"}{search && ` matching “${search}”`}</span><span><Icon name="meta" size={15} /> Published data from Meta Ads</span></div>
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
        <td className="action-cell">{item.lastQa && !["STALE", "Not checked"].includes(status) ? <Button className="row-action" onClick={() => navigate(`report/${campaign.id}`)}>View report<Icon name="arrow" size={14} /></Button> : <Button className="row-action run-check" disabled={busy === `qa:${campaign.id}`} onClick={() => runQa(campaign.id)}>{busy === `qa:${campaign.id}` ? "Checking…" : "Run check"}<Icon name="arrow" size={14} /></Button>}</td>
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

  useEffect(() => {
    if (!loading && !error && detail?.run?.status === "COMPLETED" && detail.results?.length)
      void recordReportView(detail.run.id);
  }, [loading, error, detail?.run?.id, detail?.run?.status, detail?.results?.length]);

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
      <div className="report-verdict"><div className="eyebrow">CAMPAIGN READINESS</div><Status value={detail.summary.verdict || "UNKNOWN"} label={friendlyStatus(detail.summary.verdict)} /><small>Latest QA run of published Meta data</small></div>
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
  if (result.status === "UNKNOWN" && /^AI_(NOT_CONFIGURED|UNAVAILABLE|REQUEST_FAILED|INVALID|EMPTY|RESPONSE|REFUSED|MISSING_CHECK|CONFIDENCE)/.test(result.humanMessage || "")) {
    return "Resolve the AI service error described above, then rerun QA to complete this check.";
  }
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
  const evidenceMetadata = parseReportValue(firstEvidence?.metadataJson) || {};
  const captureSources = Array.isArray(evidenceMetadata.captureSources) ? evidenceMetadata.captureSources : [];
  const copyIssues = result.checkType === "copy_quality" ? parseReportValue(result.observedJson)?.issues || [] : [];
  const campaignQuote = analysis.source_evidence || analysis.sourceEvidence || "";
  const pageQuote = analysis.page_evidence || analysis.pageEvidence || "";
  const showCapturedText = result.checkType !== "budget" && firstEvidence?.excerpt;
  const capturedTextLabel = firstEvidence?.evidenceType === "HTML_AND_META_FIELDS"
    ? "View captured page evidence"
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
      {(campaignQuote || pageQuote) && <div className="quoted-evidence">{campaignQuote && <blockquote><span>From your campaign</span><p>{campaignQuote}</p></blockquote>}{hasCombinedLocationEvidence ? <blockquote><span>Offer and delivery evidence from captured sources</span><p>{analysis.offer_page_evidence && <>Offer terms: {analysis.offer_page_evidence}<br /></>}{analysis.service_page_evidence && <>Delivery or service: {analysis.service_page_evidence}</>}</p></blockquote> : pageQuote && <blockquote><span>From the landing page</span><p>{pageQuote}</p></blockquote>}</div>}
      {showCapturedText && <details className="captured-evidence"><summary>{capturedTextLabel}</summary>{captureSources.length > 0 && <ul>{captureSources.map((source, index) => { const url = safeExternalUrl(source.url); return <li key={`${source.url}-${index}`}>{source.kind === "STORE_POLICY" ? "Store policy: " : "Landing page: "}{url ? <a href={url} target="_blank" rel="noreferrer">{source.title || source.url}</a> : source.title || "Source unavailable"}</li>; })}</ul>}{evidenceMetadata.supportingPageGaps && <p>Some linked policy pages could not be read. Review delivery and offer coverage before launch.</p>}<blockquote><span>{firstEvidence.source || firstEvidence.evidenceType || "Source details"}</span><p>{firstEvidence.excerpt}</p></blockquote></details>}
      <div className="suggested-step"><strong>Suggested next step</strong><p>{nextStep(result)}</p></div>
    </div>}
  </article>;
}

function SiteWatch({ data, selectedCampaignId, busy, checkCampaign, monitorCampaign, actOnIncident }) {
  const { campaigns = [], incidents = [] } = data;
  const monitored = campaigns.filter((item) => item.monitoringEnabled);
  const [selectedId, setSelectedId] = useState(selectedCampaignId || "");
  const [details, setDetails] = useState(null);
  const [detailError, setDetailError] = useState("");
  const selected = monitored.find((item) => item.campaign.id === selectedId) || null;
  const incidentGroups = groupIncidents(incidents.filter((incident) => incident.campaignId === selected?.campaign.id));
  useEffect(() => {
    if (selectedCampaignId) setSelectedId(selectedCampaignId);
  }, [selectedCampaignId]);
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
    <PageHeading eyebrow="CONTINUOUS MONITORING" title="Always on watch" action={<div className="watch-heading-actions"><span className="monitoring-label"><span className={`signal-dot ${monitored.length ? "online" : ""}`} />{monitored.length ? "Checks every 60 seconds" : "No active watches"}</span><a className="button secondary incident-report-link" href={incidentReportHref()}>Full incident report <Icon name="arrow" size={15} /></a></div>}>Keep a close eye on the pages your campaigns send people to.</PageHeading>
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
          <div className="site-detail-head"><div><div className="eyebrow">MONITORED CAMPAIGN</div><h2>{selected.campaign.name}</h2><p>{campaignObjective(selected.campaign.objective)} · {data.billing.monitoringActive ? `Every ${data.billing.monitoringIntervalMinutes} minutes` : "Coverage paused"}</p></div><Status value={!data.billing.monitoringActive ? "UNKNOWN" : data.billing.monitoredPages.blocked.length || data.billing.adAccounts.used > data.billing.adAccounts.limit ? "WARNING" : selected.lastMonitoringAt ? "PASS" : "UNKNOWN"} label={!data.billing.monitoringActive ? "Coverage paused" : data.billing.monitoredPages.blocked.length || data.billing.adAccounts.used > data.billing.adAccounts.limit ? "Review coverage" : selected.lastMonitoringAt ? "Watch enabled" : "Waiting for first check"} /></div>
          <div className="site-timing"><div><span>Last check</span><strong>{formatDate(selected.lastMonitoringAt)}</strong></div><div><span>Next scheduled</span><strong>{formatDate(selected.nextMonitoringAt)}</strong></div><div><span>Current destinations</span><strong>{selected.monitoringDestinationCount ?? 0}</strong></div></div>
          <div className="site-actions"><Button kind="primary" icon="refresh" disabled={busy === "campaign-monitor:" + selected.campaign.id} onClick={() => checkCampaign(selected.campaign.id)}>{busy === "campaign-monitor:" + selected.campaign.id ? "Checking campaign…" : "Check now"}</Button><Button icon="watch" disabled={busy === "monitor:" + selected.campaign.id} onClick={() => monitorCampaign(selected.campaign.id, false)}>Pause watch</Button></div>
          {detailError && <div className="alert error" role="alert">{detailError}</div>}
          {details && <section className="history-section"><div className="section-heading"><h3>Current ad destinations</h3><span>Refreshed from Meta for each check</span></div>
            {details.destinations.length === 0 ? <Empty title="No current ad destinations">The latest Meta campaign data contains no destination URL to inspect.</Empty> : <div className="history-list">{details.destinations.map((destination) => {
              const latest = destination.latestSnapshot;
              const safeUrl = safeExternalUrl(destination.url);
              return <div key={destination.url} className="history-row destination-history-row"><span className={"history-mark " + (latest ? statusTone(latest.status) : "")} aria-hidden="true">{latest?.status === "PASS" ? "OK" : latest ? "!" : "-"}</span><div className="history-copy"><strong>{safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer">{destination.url}</a> : destination.url}</strong><small>{destination.ads?.length ? "Used by: " + destination.ads.join(", ") : "Current campaign destination"}</small><small>{latest ? latest.status + " | HTTP " + (latest.httpStatus || "?") + (latest.pageTitle ? " | " + latest.pageTitle : "") : "Not checked yet"}{latest?.errorCode ? " | " + latest.errorCode : ""}</small></div><time>{destination.lastCheckedAt ? formatDate(destination.lastCheckedAt) : (destination.snapshotCount || 0) + " checks"}</time></div>;
            })}</div>}
          </section>}
          <section className="history-section"><div className="section-heading incident-section-heading"><h3>Campaign incidents <span className="count-label">{incidentGroups.length} type{incidentGroups.length === 1 ? "" : "s"}</span></h3><a className="text-link" href={incidentReportHref({ campaignId: selected.campaign.id })}>View full report <Icon name="arrow" size={14} /></a></div>
            {incidentGroups.length === 0 ? <p className="muted-copy">No incidents have been recorded for this campaign.</p> : <><p className="incident-summary-note">One summary per incident type. Intentional settings apply across this campaign until reverted.</p><div className="incident-list">{incidentGroups.map((group) => <IncidentSummary key={group.type} group={group} campaignId={selected.campaign.id} actOnIncident={actOnIncident} busy={busy} />)}</div></>}
          </section>
        </>}
      </section>
    </div>
  </>;
}

function IncidentValues({ incident }) {
  return <div className="incident-values"><span>Before: {incidentValueText(incident.oldValue)}</span><span>Observed: {incidentValueText(incident.newValue)}</span></div>;
}

function IncidentActions({ incident, actOnIncident, busy }) {
  const intentional = incident.status === "INTENTIONAL";
  return <span className="incident-buttons">
    <Button disabled={Boolean(busy)} onClick={() => actOnIncident(incident, "recheck")}>Recheck</Button>
    <Button disabled={Boolean(busy)} onClick={() => actOnIncident(incident, intentional ? "revert-intentional" : "mark-intentional")}>{intentional ? "Revert intentional" : "Mark intentional"}</Button>
  </span>;
}

function IncidentSummary({ group, campaignId, actOnIncident, busy }) {
  const incident = group.representative;
  const url = safeExternalUrl(incident.evidenceJson?.url);
  return <article className="incident-card incident-summary">
    <div className="incident-card-head"><strong>{incidentTypeLabel(group.type)}</strong><Status value={group.openCount ? "OPEN" : group.intentionalCount ? "INTENTIONAL" : group.latest.status} label={group.openCount ? `${group.openCount} open` : undefined} /></div>
    <p>{group.totalCount} incident{group.totalCount === 1 ? "" : "s"} recorded{group.pageCount ? ` · ${group.pageCount} ${group.openCount ? "affected" : "previously affected"} page${group.pageCount === 1 ? "" : "s"}` : ""}</p>
    <IncidentValues incident={incident} />
    {url && <a className="incident-page-url" href={url} target="_blank" rel="noreferrer">{url}</a>}
    {group.intentionalCount > 0 && !group.openCount && <p className="incident-intentional-note">Intentional for this campaign until reverted. Future incidents of this type will not open alerts.</p>}
    <div className="incident-foot"><span>{group.openCount ? "Latest open observation" : "Last seen"}: {formatDate(incident.lastSeenAt)}</span><a className="text-link" href={incidentReportHref({ campaignId, type: group.type })}>Review incidents <Icon name="arrow" size={14} /></a><IncidentActions incident={incident} actOnIncident={actOnIncident} busy={busy} /></div>
  </article>;
}

function IncidentReport({ data, route, busy, actOnIncident }) {
  const { campaigns = [], incidents = [] } = data;
  const campaignId = route.campaignId || "";
  const type = route.type || "";
  const status = route.status || "";
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [report, setReport] = useState({ path: "", loading: true, incidents: [], error: "" });
  const params = new URLSearchParams();
  if (campaignId) params.set("campaignId", campaignId);
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  const path = `/api/incidents/report${params.size ? `?${params}` : ""}`;
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setReport({ path, loading: true, incidents: [], error: "" });
    request(path, { signal: controller.signal }).then((records) => {
      if (active) setReport({ path, loading: false, incidents: records.slice(0, INCIDENT_REPORT_LIMIT), error: "" });
    }).catch((error) => {
      if (active) setReport({ path, loading: false, incidents: [], error: error.message });
    });
    return () => { active = false; controller.abort(); };
  }, [path, incidents, refreshVersion]);
  const loading = report.path !== path || report.loading;
  const campaignNames = new Map(campaigns.map((item) => [item.campaign.id, item.campaign.name]));
  for (const incident of incidents) {
    if (incident.campaignId && !campaignNames.has(incident.campaignId)) campaignNames.set(incident.campaignId, `Campaign ${incident.campaignId.slice(0, 8)}`);
  }
  if (campaignId && !campaignNames.has(campaignId)) campaignNames.set(campaignId, `Campaign ${campaignId.slice(0, 8)}`);
  const types = new Set([...Object.keys(INCIDENT_TYPES), ...incidents.map((incident) => incidentType(incident.type))]);
  if (type) types.add(type);
  const changeFilter = (name, value) => {
    window.location.hash = incidentReportHref({ campaignId, type, status, [name]: value });
  };
  return <>
    <PageHeading eyebrow="MONITORING HISTORY" title="Incident report" action={<a className="button secondary incident-report-link" href="#/site-watch"><Icon name="watch" size={16} />Campaign watch</a>}>Review up to {INCIDENT_REPORT_LIMIT} recent incidents, including open issues, recoveries, and intentional changes.</PageHeading>
    <section className="panel incident-report-panel">
      <div className="panel-heading"><div><h2>Recent incidents</h2><p>Filters search your full history. Up to {INCIDENT_REPORT_LIMIT} matches are shown, most recently seen first.</p></div><Button icon="refresh" disabled={loading || Boolean(busy)} onClick={() => setRefreshVersion((version) => version + 1)}>Refresh</Button></div>
      <div className="incident-report-filters">
        <div className="incident-report-filter"><label htmlFor="incident-campaign">Campaign</label><select id="incident-campaign" value={campaignId} onChange={(event) => changeFilter("campaignId", event.target.value)}><option value="">All campaigns and pages</option>{[...campaignNames].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>
        <div className="incident-report-filter"><label htmlFor="incident-type">Incident type</label><select id="incident-type" value={type} onChange={(event) => changeFilter("type", event.target.value)}><option value="">All incident types</option>{[...types].map((value) => <option key={value} value={value}>{incidentTypeLabel(value)}</option>)}</select></div>
        <div className="incident-report-filter"><label htmlFor="incident-status">Status</label><select id="incident-status" value={status} onChange={(event) => changeFilter("status", event.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="INTENTIONAL">Intentional</option><option value="REVERTED">Reverted</option></select></div>
      </div>
      <p className="incident-report-caption" role="status">{loading ? "Loading incidents…" : report.error ? "The incident report could not be loaded." : `Showing ${report.incidents.length}${report.incidents.length === INCIDENT_REPORT_LIMIT ? ` most recent` : ""} incident${report.incidents.length === 1 ? "" : "s"}.`}{!loading && (campaignId || type || status) && <a className="text-link" href={incidentReportHref()}>Clear filters</a>}</p>
      {loading ? <div className="center-state inline"><div className="spinner" /><p>Loading incident details…</p></div> : report.error ? <div className="alert error" role="alert"><span>{report.error}</span><Button onClick={() => setRefreshVersion((version) => version + 1)}>Try again</Button></div> : report.incidents.length === 0 ? <Empty title="No matching incidents">Choose another filter or check back after the next monitoring run.</Empty> : <div className="incident-list">{report.incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} campaignName={incident.campaignId ? campaignNames.get(incident.campaignId) || "Campaign unavailable" : "Standalone page"} actOnIncident={actOnIncident} busy={busy} />)}</div>}
    </section>
  </>;
}

function IncidentCard({ incident, campaignName, actOnIncident, busy }) {
  const url = safeExternalUrl(incident.evidenceJson?.url);
  return <article className="incident-card incident-report-card">
    <div className="incident-card-head"><strong>{incident.title || incidentTypeLabel(incident.type)}</strong><Status value={incident.status} /></div>
    <p>{campaignName} · {incident.severity || "Severity not specified"}</p>
    {url && <a className="incident-page-url" href={url} target="_blank" rel="noreferrer">{url}</a>}
    {incident.type?.startsWith("claim:") && <p>Watched claim: {incident.type.slice(6)}</p>}
    <IncidentValues incident={incident} />
    {incident.status === "INTENTIONAL" && <p className="incident-intentional-note">Intentional for this {incident.campaignId ? "campaign" : "page"} until reverted. Applies to all future incidents of this type.</p>}
    <div className="incident-foot"><span>First seen {formatDate(incident.firstSeenAt)} · Last seen {formatDate(incident.lastSeenAt)}{incident.resolvedAt ? ` · ${incident.status === "INTENTIONAL" ? "Marked intentional" : incident.status === "REVERTED" ? "Reverted" : "Resolved"} ${formatDate(incident.resolvedAt)}` : ""}</span><IncidentActions incident={incident} actOnIncident={actOnIncident} busy={busy} /></div>
    {incident.resolutionNote && <p className="incident-resolution-note">{incident.resolutionNote}</p>}
  </article>;
}

function Settings({ data, account, onSignedOut, busy, syncMeta, disconnectMeta, savePreferences, saveAutomaticPausing }) {
  const { meta, campaigns = [], preferences } = data;
  const simulation = preferences.autoPauseSimulation === true;
  const [pauseSimulations, setPauseSimulations] = useState([]);
  const [pauseHistoryError, setPauseHistoryError] = useState("");
  const [showAutoPauseWarning, setShowAutoPauseWarning] = useState(false);
  const [autoPauseWarningError, setAutoPauseWarningError] = useState("");
  useEffect(() => {
    if (!simulation) return;
    let active = true;
    request("/api/audit-events?eventType=CAMPAIGN_AUTO_PAUSE_SIMULATED")
      .then((events) => {
        if (active) { setPauseSimulations(events.slice(0, 5)); setPauseHistoryError(""); }
      })
      .catch(() => { if (active) setPauseHistoryError("Proposed pause history could not be loaded."); });
    return () => { active = false; };
  }, [data, simulation]);
  const connected = meta.connection?.status === "CONNECTED";
  const canPauseMetaCampaigns = connected && (simulation || meta.connection?.scopes?.includes("ads_management") === true);
  const savingAutoPause = busy === "auto-pause";
  const savingPreferences = busy === "preferences";
  const confirmAutoPause = async () => {
    setAutoPauseWarningError("");
    const result = await saveAutomaticPausing(true);
    if (result.ok) setShowAutoPauseWarning(false);
    else setAutoPauseWarningError(result.message);
  };
  const accounts = meta.accounts || [];
  return <>
    <PageHeading eyebrow="MAKE IT YOURS" title="Workspace settings" >Your connections, monitoring, and notifications. Just the way you need them.</PageHeading>
    <section className="panel settings-account"><div className="settings-title"><div className="section-title"><span className="integration-icon"><Icon name="meta" size={28} /></span><div><h2>Meta Ads</h2><p>Your campaign source, connected securely.</p></div></div><Status value={connected ? "CONNECTED" : "UNKNOWN"} label={connected ? "Connected" : "Not connected"} /></div>
      <div className="settings-connection"><div><strong>{accounts.length} ad account{accounts.length === 1 ? "" : "s"} available</strong><p>{accounts.filter((account) => account.selected).length} selected for campaign sync</p></div>{meta.connection?.lastSyncAt && <small><Icon name="clock" size={14} /> Last synced {formatDate(meta.connection.lastSyncAt)}</small>}</div>
      {accounts.length > 0 && <details className="connected-accounts"><summary>View connected ad accounts <Icon name="chevron" size={15} /></summary><div className="account-details">{accounts.map((account) => <span key={account.id}><strong>{account.name}{account.selected && <span className="account-selected"><Icon name="check" size={12} /> Selected</span>}</strong><small>{account.externalId} · {account.currency || "Currency unavailable"}</small></span>)}</div></details>}
      {!accounts.length && <p className="muted-copy">{connected ? "Sync your account to discover available campaigns." : "Connect Meta Ads to bring your campaigns into Click Cohere."}</p>}
      <div className="settings-actions">{meta.connection ? <>
        <Button icon="refresh" onClick={syncMeta} disabled={!connected || busy === "sync" || busy === "meta-accounts"}>{busy === "sync" ? "Syncing…" : accounts.length ? "Refresh accounts" : "Discover ad accounts"}</Button>
        <Button icon="link" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Reconnect</Button><Button className="destructive-text" onClick={disconnectMeta}>Disconnect</Button>
      </> : <Button kind="primary" icon="link" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connect Meta Ads</Button>}</div>
      {meta.connection?.lastError && <div className="alert error">{meta.connection.lastError}</div>}
    </section>
    <div className="settings-grid">
      <section className="panel settings-monitoring"><span className="settings-section-icon"><Icon name="watch" size={22} /></span><h2>Campaign monitoring</h2><p>Fresh campaign details and destination checks, automatically.</p><div className="setting-line"><span>Check interval</span><strong>Every {data.billing.monitoringIntervalMinutes} minutes</strong></div><div className="setting-line"><span>Watches enabled</span><strong>{campaigns.filter((item) => item.monitoringEnabled).length} enabled</strong></div><a className="text-link" href="#/site-watch">Manage campaign watches <Icon name="arrow" size={15} /></a></section>
      <form className="panel settings-notifications" onSubmit={savePreferences}><span className="settings-section-icon"><Icon name="mail" size={22} /></span><h2>Stay in the loop</h2><p>Choose which campaign updates reach your inbox.</p>
        <label className="form-label">Notification email<input type="email" name="email" required maxLength="254" defaultValue={preferences.email} /></label>
        <label className="toggle-row"><span><strong>New incidents</strong><small>When a monitored page changes or fails.</small></span><input type="checkbox" name="incidentAlertsEnabled" defaultChecked={preferences.incidentAlertsEnabled} aria-label="Email me about new incidents" /></label>
        <label className="toggle-row"><span><strong>Recovery updates</strong><small>When a new check verifies recovery.</small></span><input type="checkbox" name="recoveryAlertsEnabled" defaultChecked={preferences.recoveryAlertsEnabled} aria-label="Email me about recovery updates" /></label>
        <div className="auto-pause-setting">
          <label className="toggle-row auto-pause-row">
            <span className="auto-pause-copy"><strong className="auto-pause-heading">Automatic campaign pausing <span className="auto-pause-beta-badge">Beta</span></strong><small id="auto-pause-description">{simulation ? "Record proposed pauses after confirmed page failures. This environment is in simulation mode." : "Pause monitored, active Meta campaigns after two confirmed page failures and a fresh check."} Blocked or uncertain checks do not qualify.</small></span>
            <span className="auto-pause-control">
              <input type="checkbox" role="switch" name="autoPauseCampaignOnWebsiteDown" checked={preferences.autoPauseCampaignOnWebsiteDown} disabled={savingAutoPause || savingPreferences || (!preferences.autoPauseCampaignOnWebsiteDown && !canPauseMetaCampaigns)} onChange={(event) => {
                if (event.target.checked) { setAutoPauseWarningError(""); setShowAutoPauseWarning(true); }
                else saveAutomaticPausing(false);
              }} aria-label="Automatically pause campaigns after confirmed landing page failures" aria-describedby={`auto-pause-description auto-pause-disclaimer auto-pause-save-note${canPauseMetaCampaigns ? "" : " auto-pause-permission"}`} />
              <span className="auto-pause-state" aria-hidden="true"><span className="auto-pause-on">On</span><span className="auto-pause-off">Off</span></span>
            </span>
          </label>
          <div className="auto-pause-disclaimer" id="auto-pause-disclaimer" role="note">
            <Icon name="warning" size={18} />
            <div><strong>{simulation ? "Simulation mode: campaigns keep running" : "Beta feature: changes live campaigns"}</strong><p>{simulation ? "Proposed pauses appear below for review. Simulation does not stop ad spending during an outage." : "Review the beta warning before enabling. Paused campaigns must be restarted manually in Meta Ads."}</p></div>
          </div>
          {!canPauseMetaCampaigns && <p className="auto-pause-note" id="auto-pause-permission">{simulation ? "Connect Meta Ads to use pause simulation." : "Reconnect Meta Ads and allow campaign management to use auto pause."}</p>}
          <p className="auto-pause-note" id="auto-pause-save-note" role="status">{savingAutoPause ? "Saving automatic pausing…" : "This toggle saves immediately. Turning it off stops future automatic pauses and does not restart paused campaigns."}</p>
          {simulation && <div className="auto-pause-history" aria-label="Recent proposed campaign pauses"><strong>Recent proposed pauses</strong>
            {pauseHistoryError ? <p className="auto-pause-note" role="status">{pauseHistoryError}</p> : pauseSimulations.length ? <ul>{pauseSimulations.map((event) => <li key={event.id}><strong>{event.metadataJson?.campaignName || "Campaign"}</strong><small>{formatDate(event.createdAt)}</small><span>{event.metadataJson?.url}</span></li>)}</ul> : <p className="auto-pause-note">No proposed pauses recorded yet.</p>}
          </div>}
        </div>
        <Button kind="primary" type="submit" disabled={savingPreferences || savingAutoPause}>{savingPreferences ? "Saving…" : "Save preferences"}</Button>
      </form>
    </div>
    <AccountSettings account={account} request={request} onSignedOut={onSignedOut} />
    {showAutoPauseWarning && <AutoPauseBetaDialog simulation={simulation} pending={savingAutoPause} error={autoPauseWarningError} onCancel={() => { if (!savingAutoPause) setShowAutoPauseWarning(false); }} onConfirm={confirmAutoPause} />}
    <p className="security-note"><Icon name="shield" size={15} /> Your Meta connection is encrypted. Click Cohere never publishes ads.</p>
  </>;
}

function AutoPauseBetaDialog({ simulation, pending, error, onCancel, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return <dialog ref={dialog} className="incident-decision-dialog auto-pause-beta-dialog" aria-labelledby="auto-pause-beta-title" aria-describedby="auto-pause-beta-description" aria-busy={pending} onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }} onClick={(event) => { if (!pending && event.target === event.currentTarget) onCancel(); }}>
    <div className="incident-decision-content">
      <span className="eyebrow">AUTOMATIC CAMPAIGN PAUSING · BETA</span>
      <h2 id="auto-pause-beta-title">Enable automatic pausing?</h2>
      <div id="auto-pause-beta-description">
        <p>{simulation ? "This environment records proposed pauses in simulation mode. Your campaigns will keep running." : "Click Cohere can pause your monitored Meta campaigns after two confirmed website failures and a fresh check."}</p>
        <p className="incident-decision-warning"><strong>This feature is still in beta.</strong> False detections may interrupt your campaigns. Review the findings and use it only if you are comfortable with automatic campaign changes.</p>
        <p>Checks take time, so ad spend may continue before a pause. Campaigns stay paused after the page recovers or you turn this feature off. Restart them manually in Meta Ads.</p>
      </div>
      {error && <p className="alert error" role="alert">{error}</p>}
      <div className="incident-decision-actions"><button type="button" className="button secondary" autoFocus disabled={pending} onClick={onCancel}>Cancel</button><button type="button" className="button primary" disabled={pending} onClick={onConfirm}>{pending ? "Enabling…" : "I understand, enable beta"}</button></div>
    </div>
  </dialog>;
}

function WebsiteRouter() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);
  useEffect(() => {
    const titles = { home: "Click Cohere — Keep the promise behind every click", login: "Log in — Click Cohere", signup: "Create your workspace — Click Cohere", overview: "Campaign overview — Click Cohere", campaigns: "Your campaigns — Click Cohere", "site-watch": "Campaign watch — Click Cohere", incidents: "Incident report — Click Cohere", settings: "Workspace settings — Click Cohere", report: "Campaign QA report — Click Cohere" };
    titles.billing = "Plan & usage - Click Cohere";
    titles["forgot-password"] = "Recover your account — Click Cohere";
    titles["reset-password"] = "Reset password — Click Cohere";
    titles["delete-account"] = "Delete account — Click Cohere";
    document.title = titles[route.page];
    const anchor = route.page === "home" ? document.getElementById(window.location.hash.slice(1)) : null;
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [route.page]);
  return route.page === "home" ? <LandingPage /> : <App />;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><WebsiteRouter /><AnalyticsConsent /></React.StrictMode>);

function AnalysisConfirmation({ estimate, onCancel, onConfirm }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  return <dialog ref={dialog} className="incident-decision-dialog" onCancel={(event) => { event.preventDefault(); onCancel(); }} aria-labelledby="analysis-confirm-title"><div className="incident-decision-content"><div className="eyebrow">BEFORE YOU RUN</div><h2 id="analysis-confirm-title">{estimate.analysisCount} ad {estimate.analysisCount === 1 ? "analysis" : "analyses"}</h2><p>Each ad is checked against its landing page, with all supported checks included. This campaign will reserve {estimate.analysisCount} analyses while the report runs.</p><p><strong>{estimate.remaining} analyses are available.</strong> Failed work and automatic retries do not use additional analyses.</p>{!estimate.canRun && <p>Your allowance does not cover this run. Choose a plan or add analyses before continuing.</p>}<div className="incident-decision-actions"><button className="button secondary" autoFocus onClick={onCancel}>Cancel</button>{estimate.canRun ? <button className="button primary" onClick={onConfirm}>Run {estimate.analysisCount} analyses</button> : <a className="button primary" href="#/billing" onClick={onCancel}>Review plan & usage</a>}</div></div></dialog>;
}
