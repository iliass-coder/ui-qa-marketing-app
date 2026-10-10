import test from "node:test";
import assert from "node:assert/strict";
import { campaignIsLive, campaignPhase, statusTone, valueText } from "../src/domain.js";

test("campaign state distinguishes active, future, and paused campaigns", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(campaignIsLive({ status: "ACTIVE" }, now), true);
  assert.equal(campaignPhase({ status: "ACTIVE", startAt: "2026-10-11T00:00:00Z" }, now), "Scheduled");
  assert.equal(campaignPhase({ status: "PAUSED" }, now), "Draft / paused");
});

test("backend verdicts map to calm semantic status colors", () => {
  assert.equal(statusTone("PASS"), "good");
  assert.equal(statusTone("STALE"), "caution");
  assert.equal(statusTone("FAIL"), "bad");
  assert.equal(statusTone("UNKNOWN"), "neutral");
});

test("report values remain readable for scalar and structured backend evidence", () => {
  assert.equal(valueText("$29"), "$29");
  assert.equal(valueText({ status: 200 }), '{"status":200}');
  assert.equal(valueText(null), "Not available");
});
