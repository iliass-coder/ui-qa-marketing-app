import React, { useState } from "react";
import { Brand } from "./Brand.jsx";
import { Icon } from "./icons.jsx";
import { formatDate } from "./domain.js";

export function MetaConnectionNotice({ meta }) {
  if (!meta?.connection) return null;
  const { tokenHealth = {}, connection } = meta;
  const expiry = tokenHealth.expiresAt;
  let status = tokenHealth.status || "UNKNOWN";
  if (expiry && new Date(expiry).getTime() <= Date.now()) status = "EXPIRED";
  const messages = {
    EXPIRING: ["Meta access expires soon", `Reconnect before ${formatDate(expiry)} to keep campaign sync, monitoring, and auto pause available.`],
    EXPIRED: ["Meta access has expired", "Reconnect Meta Ads to restore campaign sync, campaign monitoring, and auto pause. Previously imported data is still visible."],
    RECONNECT_REQUIRED: ["Meta access needs to be renewed", "Meta access or required permissions are no longer available. Reconnect to restore campaign sync, monitoring, and auto pause."],
    UNKNOWN: ["Meta access expiry is unverified", "Reconnect Meta Ads to confirm access before relying on automatic monitoring."],
    CHECK_FAILED: ["Meta access could not be verified", "We will check again. Reconnect if access has changed, and review your campaigns directly in Meta while verification is unavailable."]
  };
  const message = messages[status] || messages[connection.status];
  if (!message) return null;
  return <div className="alert connection-alert token-notice" role="status">
    <div><strong><Icon name="warning" size={17} /> {message[0]}</strong><span>{message[1]}</span></div>
    <a className="button secondary" href="/api/integrations/meta/connect"><Icon name="link" size={16} />Reconnect Meta Ads</a>
  </div>;
}

export function RecoveryPage({ mode, token = "", request, enabled, account, onSignedOut }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
  const deleting = mode === "delete-account";
  const resetting = mode === "reset-password";
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    if (resetting && form.get("password") !== form.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (deleting) {
        await request("/api/account", { method: "DELETE", body: { token, confirmation: form.get("confirmation") } });
        onSignedOut("Your account has been deleted.");
      } else if (resetting) {
        await request("/api/auth/reset-password", { method: "POST", body: { token, password: form.get("password") } });
        onSignedOut("Password reset. Sign in with your new password.");
      } else {
        await request("/api/auth/forgot-password", { method: "POST", body: { email: form.get("email") } });
        setNotice("If an eligible account uses that email, a reset link will arrive shortly. Check your spam folder too. The link expires in 30 minutes.");
      }
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return <main className="recovery-page"><a href="/" className="recovery-brand" aria-label="Click Cohere home"><Brand /></a>
    <section className="panel recovery-card">
      <span className="settings-section-icon"><Icon name={deleting ? "warning" : "shield"} size={22} /></span>
      <h1>{deleting ? "Delete your account" : resetting ? "Choose a new password" : "Forgot your password?"}</h1>
      <p>{deleting ? `Confirm deletion of ${account?.user?.email || "your account"}. This action is permanent.` : resetting ? "Use at least 8 characters. All devices will be signed out after the reset." : "Enter your account email and we will send you a password reset link."}</p>
      {error && <div className="alert error" role="alert">{error}</div>}
      {notice && <div className="alert success" role="status">{notice}</div>}
      {deleting && <div className="alert" role="note">{account?.workspaceMemberCount === 1 ? "You are the last workspace member. Your workspace, imported campaigns, monitoring history, and stored Meta connection will be permanently deleted." : "Your account and all its sessions will be deleted. Other members will retain access to the shared workspace."} Your campaigns in Meta will remain in their current state, including any campaigns already paused.</div>}
      {(resetting || deleting) && !validToken ? <div className="alert error" role="alert">This confirmation link is missing or invalid. {resetting ? <a href="#/forgot-password">Request a new reset link.</a> : <a href="#/settings">Request a new deletion email from settings.</a>}</div> : <form className="form-stack" onSubmit={submit}>
        {deleting ? <label>Type DELETE to confirm<input name="confirmation" autoComplete="off" required pattern="DELETE" maxLength="6" /></label> : resetting ? <>
          <label>New password<input type="password" name="password" autoComplete="new-password" required minLength="8" maxLength="200" /></label>
          <label>Confirm new password<input type="password" name="confirmPassword" autoComplete="new-password" required minLength="8" maxLength="200" /></label>
        </> : <label>Email address<input type="email" name="email" autoComplete="email" required maxLength="254" /></label>}
        <button className={`button ${deleting ? "danger" : "primary"}`} disabled={busy || (!deleting && !resetting && enabled !== true)} type="submit">{busy ? "Working…" : deleting ? "Permanently delete my account" : resetting ? "Reset password" : "Send reset link"}</button>
      </form>}
      {!deleting && !resetting && enabled === false && <p className="account-help">Recovery email is currently unavailable. Contact your workspace administrator.</p>}
      <a className="text-link recovery-back" href={deleting ? "#/settings" : "#/login"}>{deleting ? "Cancel and return to settings" : "Back to sign in"}</a>
    </section>
  </main>;
}

export function AccountSettings({ account, request, onSignedOut }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const emailEnabled = account?.accountRecoveryEnabled === true;
  const sendEmail = async (deleting) => {
    setBusy(deleting ? "delete" : "reset");
    setError("");
    setNotice("");
    try {
      await request(deleting ? "/api/account/deletion-request" : "/api/auth/forgot-password", {
        method: "POST", ...(deleting ? {} : { body: { email: account.user.email } })
      });
      setNotice(`Check ${account.user.email} for ${deleting ? "a deletion confirmation" : "a password reset"} link. The link expires in 30 minutes.${deleting ? " Your account has not been deleted yet." : ""}`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  };
  const changePassword = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy("password");
    try {
      await request("/api/account/password", { method: "POST", body: { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") } });
      onSignedOut("Password changed. All devices have been signed out. Sign in with your new password.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy("");
    }
  };
  return <section className="panel account-security">
    <span className="settings-section-icon"><Icon name="shield" size={22} /></span><h2>Account &amp; security</h2><p>Manage sign-in and account access for {account?.user?.email}.</p>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert success" role="status">{notice}</div>}
    {account?.passwordEnabled ? <form className="form-stack account-password-form" onSubmit={changePassword}>
      <h3>Change password</h3>
      <input type="text" name="username" autoComplete="username" value={account.user.email} className="sr-only" readOnly tabIndex="-1" aria-hidden="true" />
      <label>Current password<input type="password" name="currentPassword" autoComplete="current-password" required maxLength="200" /></label>
      <label>New password<input type="password" name="newPassword" autoComplete="new-password" required minLength="8" maxLength="200" /></label>
      <label>Confirm new password<input type="password" name="confirmPassword" autoComplete="new-password" required minLength="8" maxLength="200" /></label>
      <p className="account-help">Use at least 8 characters. Changing your password signs out all devices.</p>
      <button className="button secondary" disabled={Boolean(busy)} type="submit">{busy === "password" ? "Updating…" : "Change password"}</button>
      {emailEnabled && <button className="text-button account-reset-link" type="button" disabled={Boolean(busy)} onClick={() => sendEmail(false)}>Forgot your current password? Send a reset link</button>}
    </form> : <div className="account-password-form"><h3>Add a password</h3><p className="account-help">You use Google to sign in. An email link lets you add a password for email sign-in.</p><button className="button secondary" disabled={Boolean(busy) || !emailEnabled} onClick={() => sendEmail(false)}>Send password setup link</button></div>}
    <div className="account-deletion"><h3>Delete account</h3><p>Delete your account and sign out all devices. If you are the last member, your workspace data and stored Meta connection will also be permanently deleted, and your paid subscription will be canceled. You will confirm using a link sent to your account email.</p><p>Your campaigns in Meta will remain in their current state.</p>
      <button className="button danger" disabled={Boolean(busy) || !emailEnabled} onClick={() => sendEmail(true)}>{busy === "delete" ? "Sending…" : "Email deletion confirmation"}</button>
    </div>
    {!emailEnabled && <p className="account-help">Recovery emails are currently unavailable. Contact your workspace administrator for account recovery or deletion.</p>}
  </section>;
}
