import test from "node:test";
import assert from "node:assert/strict";
import { campaignLabel, publicAnalyticsPage } from "../src/analytics.js";

test("public tracking never records workspace IDs or authentication recovery tokens from routes", () => {
  assert.equal(publicAnalyticsPage("/", "#pricing"), "landing");
  assert.equal(publicAnalyticsPage("/", "#/signup?plan=STARTER"), "signup");
  assert.equal(publicAnalyticsPage("/", "#/login"), "login");
  for (const route of ["#/report/private-campaign", "#/reset-password?token=secret", "#/delete-account?token=secret", "#/settings"])
    assert.equal(publicAnalyticsPage("/", route), null);
  assert.equal(publicAnalyticsPage("/login/oauth2/code/google", ""), null);
});

test("campaign attribution accepts labels and rejects URLs, emails, and oversized input", () => {
  assert.equal(campaignLabel("google"), "google");
  assert.equal(campaignLabel("launch_october-2026"), "launch_october-2026");
  assert.equal(campaignLabel("https://example.com/?access_token=secret"), "");
  assert.equal(campaignLabel("person@example.com"), "");
  assert.equal(campaignLabel("a".repeat(101)), "");
});
