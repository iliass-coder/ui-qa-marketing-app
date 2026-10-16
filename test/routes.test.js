import test from "node:test";
import assert from "node:assert/strict";
import { resolveRoute } from "../src/routes.js";

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
