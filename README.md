# SteadySignal frontend

Responsive React application for the SteadySignal campaign QA and landing-page monitoring product. This folder contains only the frontend; backend source and implementation remain in the separate backend project.

## Run locally

Requirements: Node.js 20+ and npm.

```powershell
npm ci
npm run dev
```

Vite serves the UI at `http://127.0.0.1:5173` and proxies `/api` requests to the existing backend at `http://127.0.0.1:8080`. Start that backend separately. Keep the browser on the same host (`127.0.0.1`) while signing in so the HttpOnly session cookie is reused.

## Build and test

```powershell
npm test
npm run build
```

Production files are written to `dist/`. Serve the frontend and backend API on the same origin, routing `/api` to the backend. This preserves the backend's session-cookie, CSRF-header, and OAuth redirect behavior without introducing duplicate API implementations.

The Meta OAuth callback must return to the backend origin configured as `APP_ORIGIN`, with the corresponding callback URL registered in Meta. The frontend never reads or stores the Meta access token.

## Backend contract used by this UI

The UI uses the existing backend routes for login/session, Meta connection and sync, campaigns/ads, QA runs/results/evidence, sites/snapshots/incidents, notification preferences, dashboard counts, and job status. The 30-minute monitoring schedule and URL safety checks remain server-side. Configure Meta, database, and email credentials only in the backend project.
