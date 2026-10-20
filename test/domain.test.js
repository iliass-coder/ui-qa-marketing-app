import test from "node:test";
import assert from "node:assert/strict";
import { campaignIsLive, campaignPhase, statusTone, valueText } from "../src/domain.js";
import { groupIncidents, incidentValueText } from "../src/incidents.js";

test("campaign state distinguishes active, future, and paused campaigns", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");
  assert.equal(campaignIsLive({ status: "ACTIVE" }, now), true);
  assert.equal(campaignPhase({ status: "ACTIVE", startAt: "2026-10-11T00:00:00Z" }, now), "Scheduled");
  assert.equal(campaignPhase({ status: "PAUSED" }, now), "Paused");
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

test("incident summaries combine repeated records and keep open issues visible ahead of newer recoveries", () => {
  const records = [
    { id: "new-price", type: "prices", siteId: "page-a", status: "RESOLVED", lastSeenAt: "2026-10-19T20:00:00Z" },
    { id: "open-price", type: "prices", siteId: "page-a", status: "OPEN", lastSeenAt: "2026-10-19T19:00:00Z" },
    { id: "other-page", type: "prices", siteId: "page-b", status: "OPEN", lastSeenAt: "2026-10-19T18:00:00Z" },
    { id: "new-content", type: "content", siteId: "page-a", status: "RESOLVED", lastSeenAt: "2026-10-19T21:00:00Z" }
  ];
  const summaries = groupIncidents(records);
  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].type, "prices");
  assert.equal(summaries[0].totalCount, 3);
  assert.equal(summaries[0].openCount, 2);
  assert.equal(summaries[0].pageCount, 2);
  assert.equal(summaries[0].representative.id, "open-price");
  assert.equal(summaries[0].latest.id, "new-price");
  assert.equal(records[0].id, "new-price");
});

test("different missing claims produce one summary and repeated observations of one page count once", () => {
  const summaries = groupIncidents([
    { type: "claim:Free shipping", siteId: "page-a", status: "OPEN" },
    { type: "claim:Money back guarantee", siteId: "page-a", status: "OPEN" },
    { type: "claim:Free shipping", siteId: "page-a", status: "INTENTIONAL" }
  ]);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].type, "claims");
  assert.equal(summaries[0].openCount, 2);
  assert.equal(summaries[0].pageCount, 1);
  assert.deepEqual(groupIncidents([]), []);
});

test("incident price evidence explains unknown currency without raw JSON", () => {
  assert.equal(incidentValueText({ value: [{ amount: "55.00", currency: "UNKNOWN" }] }), "55.00 (currency unknown)");
  assert.equal(incidentValueText({ value: [{ amount: "56.00", currency: "EUR" }] }), "56.00 EUR");
  assert.equal(incidentValueText({ value: "HTTP_ERROR" }), "HTTP_ERROR");
});

test("intentional settings remain visible when newer history shows a recovery", () => {
  const [group] = groupIncidents([
    { id: "accepted", type: "availability", status: "INTENTIONAL", lastSeenAt: "2026-10-19T19:00:00Z" },
    { id: "old-recovery", type: "availability", status: "RESOLVED", lastSeenAt: "2026-10-19T20:00:00Z" }
  ]);
  assert.equal(group.intentionalCount, 1);
  assert.equal(group.representative.id, "accepted");
  const [reverted] = groupIncidents([
    { id: "accepted", type: "availability", status: "REVERTED", lastSeenAt: "2026-10-19T19:00:00Z" },
    { id: "fresh-failure", type: "availability", status: "OPEN", lastSeenAt: "2026-10-19T21:00:00Z" }
  ]);
  assert.equal(reverted.intentionalCount, 0);
  assert.equal(reverted.openCount, 1);
  assert.equal(reverted.representative.id, "fresh-failure");
});
