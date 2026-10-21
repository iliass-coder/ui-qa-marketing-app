import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoute } from "../src/routes.js";
import { incidentReportHref } from "../src/incidents.js";

test("the public home and section anchors stay on the landing page", () => {
  for (const hash of ["", "#/", "#product", "#how-it-works", "#questions"]) {
    assert.deepEqual(resolveRoute(hash), { page: "home" });
  }
});

test("login and signup have distinct routes alongside protected workspace links", () => {
  for (const page of ["login", "signup", "overview", "campaigns", "site-watch", "settings"]) {
    assert.deepEqual(resolveRoute(`#/${page}`), { page });
  }
  assert.deepEqual(resolveRoute("#/report/campaign-42"), { page: "report", id: "campaign-42" });
});

test("authentication callbacks reach the auth screen even when returning to the root or workspace", () => {
  assert.deepEqual(resolveRoute("", "?email_verified=success"), { page: "login" });
  assert.deepEqual(resolveRoute("#/overview", "?sso_error=no_account"), { page: "login" });
  assert.deepEqual(resolveRoute("", "?utm_source=meta"), { page: "home" });
});

test("incident reports support direct links and preserve campaign, type, and status filters", () => {
  assert.deepEqual(resolveRoute(incidentReportHref()), { page: "incidents" });
  const filters = { campaignId: "campaign-42", type: "claim:Free shipping & returns", status: "OPEN" };
  assert.deepEqual(resolveRoute(incidentReportHref(filters)), { page: "incidents", ...filters });
  assert.deepEqual(resolveRoute(incidentReportHref({ campaignId: "campaign-42", type: "claims" })), { page: "incidents", campaignId: "campaign-42", type: "claims" });
});

test("recovery routes retain confirmation tokens in the URL fragment", () => {
  assert.deepEqual(resolveRoute("#/forgot-password"), { page: "forgot-password" });
  for (const page of ["reset-password", "delete-account"]) {
    assert.deepEqual(resolveRoute(`#/${page}?token=single-use-token`), { page, token: "single-use-token" });
    assert.deepEqual(resolveRoute(`#/${page}`), { page, token: "" });
  }
});

test("Meta authorization cancellation returns to settings with a clear notice", () => {
  assert.deepEqual(resolveRoute("#/settings?meta_error=denied"), { page: "settings", metaError: "denied" });
});

test("billing returns preserve the checkout reference without granting access", () => {
  assert.deepEqual(resolveRoute("#/billing?checkout=success&session_id=cs_test_42"), { page: "billing", checkout: "success", sessionId: "cs_test_42", plan: "" });
  assert.deepEqual(resolveRoute("#/billing?checkout=canceled"), { page: "billing", checkout: "canceled", sessionId: "", plan: "" });
  assert.deepEqual(resolveRoute("#/signup?plan=GROWTH"), { page: "signup", plan: "GROWTH" });
  assert.deepEqual(resolveRoute("#/signup?plan=UNTRUSTED"), { page: "signup" });
});
