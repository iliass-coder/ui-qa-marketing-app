# SteadySignal frontend

Responsive React application for the SteadySignal campaign QA and landing-page monitoring product. This folder contains only the frontend; backend source and implementation remain in the separate backend project.

## Run locally

Requirements: Node.js 20+ and npm.

```powershell
npm ci
npm run dev
```

Vite serves the UI at `http://127.0.0.1:5173` and proxies `/api` requests to the existing backend at `http://127.0.0.1:8080`. Start that backend separately. Keep the browser on the same host (`127.0.0.1`) while signing in so the HttpOnly session cookie is reused.

## Public website and workspace

The public landing page at `/` renders without backend requests. Its design and final copy are documented in [the landing-page brief](docs/landing-page-brief.md). The interactive product examples use illustrative data.

| URL | Screen |
| --- | --- |
| `/` | Public landing page |
| `/#/login` | Sign in |
| `/#/signup` | Create a workspace |
| `/#/forgot-password` | Request a password reset email |
| `/#/reset-password?token=...` | Set a password with an expiring email link |
| `/#/delete-account?token=...` | Sign in and confirm account deletion |
| `/#/overview` | Authenticated workspace |
| `/#/campaigns`, `/#/site-watch`, `/#/settings` | Protected product screens |
| `/#/report/:campaignId` | Protected campaign report |
| `/#/incidents` | Protected incident report, up to 50 recent incidents |

Signed-in visitors following login or signup links continue to their workspace. Public section anchors, authentication notices, and existing report links are supported. For Google OAuth, set `GOOGLE_LOGIN_SUCCESS_URL` to the frontend's `/#/overview` URL so a successful sign-in returns directly to the workspace. Email verification and sign-in errors are routed to the login screen.

Campaign watch shows one incident summary per type for the selected campaign, with open issues first. The incident report includes individual evidence and review actions. It defaults to the most recently seen incidents across the workspace and supports campaign, type, and status filters in the URL (`/#/incidents?campaign=CAMPAIGN_ID&type=prices&status=OPEN`). `GET /api/incidents/report` applies those filters before returning up to 50 records; its campaign parameter is named `campaignId`.

Incident summaries and report cards offer **Recheck** and **Mark intentional**. Marking a type intentional opens a confirmation dialog explaining that the setting covers all current and future incidents of that type across the campaign's destination pages, until someone chooses **Revert intentional**. Missing claims are handled together as one type. Failed page inspections can also be marked intentional. Inspections continue to record evidence, while alerts for that type are suppressed. Marking page availability intentional also suppresses automatic campaign pausing for availability failures. The setting is limited to that page for standalone incidents.

**Revert intentional** restores normal handling and requests a fresh inspection. Previous intentional records become **Reverted**, and a continuing failure creates a fresh open incident. Reverted records are available through the status filter. The former Request resolution action has been removed.

## Build and test

```powershell
npm test
npm run build
```

Production files are written to `dist/`. Serve the frontend and backend API on the same origin, routing `/api` to the backend. This preserves the backend's session-cookie, CSRF-header, and OAuth redirect behavior without introducing duplicate API implementations.

The Meta OAuth callback must return to the backend origin configured as `APP_ORIGIN`, with the corresponding callback URL registered in Meta. The frontend never reads or stores the Meta access token.

After successful Meta authorization, the backend returns to `APP_ORIGIN/#/settings`. Set `META_RETURN_URL` to the frontend page URL when using a separate Vite server (for example, `http://localhost:5173/#/settings`) or to return to `/#/overview`. A cancelled authorization returns to Settings with a notice.

The campaign library imports published Meta campaigns, including paused campaigns. The **Not running** filter groups campaigns that are not currently live; each row shows its Meta status or scheduled phase. To review a new campaign before activation, publish its campaign, ad sets, and ads with the campaign switched off, then sync and run QA. Checks cover published data; unpublished drafts and unpublished edits are unavailable.

Google sign-in and sign-up are optional. Configure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the backend, and register `${APP_ORIGIN}/login/oauth2/code/google` as the Google OAuth web client's authorized redirect URI. Set `GOOGLE_LOGIN_SUCCESS_URL` to the frontend URL after sign-in. For local development, keep the hostname consistent with `APP_ORIGIN` so the session cookie is shared (for example, `localhost` for both the backend and Vite).

The access page supports account creation with email/password and Google. Email/password registration creates an isolated workspace and requires `EMAIL_VERIFICATION_ENABLED=true` plus working SMTP settings. Google sign-up creates a workspace immediately using the verified Google address; it does not require SMTP. New passwords must be at least 16 characters. `ADMIN_EMAIL` and `ADMIN_PASSWORD` only seed the initial owner on an empty database; they do not control later sign-ups.

For production SSO, the same public app host must route `/api/**`, `/oauth2/**`, and `/login/oauth2/**` to the backend. The Google OAuth web client redirect URI is `${APP_ORIGIN}/login/oauth2/code/google`; Meta continues to use `${APP_ORIGIN}/api/integrations/meta/callback`.

## Backend contract used by this UI

Sign-in lasts 48 hours without activity by default, configured on the backend with `SESSION_IDLE_TIMEOUT_HOURS`. Visible interaction and returning to the workspace renew the server session and HttpOnly cookie through `POST /api/auth/activity`, at most once a minute per tab. Background status polling does not renew it. Expired sessions return to sign-in with a notice.

Workspace settings include password changes and deletion confirmation by email. Password reset/change signs out all devices. Deletion removes the shared workspace only when its last member leaves; campaigns in Meta remain in their current state. These email flows require working backend SMTP and `ACCOUNT_RECOVERY_ENABLED=true` (defaults to `EMAIL_VERIFICATION_ENABLED` when omitted).

Meta settings show token and data-access expiry. Reconnect warnings appear seven days before the earlier expiry; expired or revoked access blocks automatic campaign actions until reconnection. Existing connections without verified metadata display an access warning. Connection status refreshes every minute and when the window regains focus. The backend exchanges fresh OAuth tokens for long-lived tokens and verifies them on a schedule; renewing access uses Meta reconnection.

The UI uses the existing backend routes for login/session, Meta connection and sync, campaigns/ads, QA runs/results/evidence, sites/snapshots/incidents, notification preferences, dashboard counts, and job status. Plan-specific monitoring intervals, quota enforcement, optional campaign auto-pause, and URL safety checks remain server-side. Configure Meta, database, and email credentials only in the backend project.

## Plans and usage

`/#/billing` shows trial status, analysis reservations and balances, monitored-page limits, selected-account limits, and usage by Meta account. Stripe hosts checkout, subscription changes, payment methods, invoices, and cancellation. Public pricing and FAQs explain the 10-analysis preview, card-free 14-day monitoring trial, Starter ($39), Growth ($99), and Agency by arrangement. Plan intent survives signup. Campaign QA confirms the analysis count before a run; the account picker enforces the displayed account allowance.

Set up the backend using [the billing guide](../qa-marketing-integration/docs/billing.md). Paid checkout stays unavailable until its two Stripe secrets are configured.
