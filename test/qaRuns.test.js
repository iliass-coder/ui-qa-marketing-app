import test from "node:test";
import assert from "node:assert/strict";
import { createQaTracker, isQaActive, latestQaRun } from "../src/qaRuns.js";

const run = (overrides = {}) => ({ id: "run-1", campaignId: "campaign-1", status: "QUEUED", createdAt: "2026-10-30T10:00:00Z", ...overrides });
const error = (status) => Object.assign(new Error("Request failed"), { status });

function harness({ saved, request = async () => run({ status: "RUNNING" }), storage: suppliedStorage } = {}) {
  let persisted = saved, state = [], settled = 0, expired = 0, writes = 0, id = 0;
  const timers = new Map();
  const storage = suppliedStorage || { getItem: () => persisted, setItem: (_, value) => { persisted = value; } };
  const tracker = createQaTracker({ request, storage, storageKey: "member-1", onChange: (runs) => { state = runs; writes++; },
    onSettled: () => { settled++; }, onExpired: () => { expired++; },
    schedule: (callback) => { timers.set(++id, callback); return id; }, cancel: (timer) => timers.delete(timer) });
  tracker.start();
  return { tracker, timers, get state() { return state; }, get persisted() { return persisted; }, get settled() { return settled; },
    get expired() { return expired; }, get writes() { return writes; },
    async tick() { const [timer, callback] = timers.entries().next().value || []; assert.ok(callback, "a status poll is scheduled"); timers.delete(timer); await callback(); } };
}

test("tracking returns immediately and polls status without submitting another check", async () => {
  const requests = [];
  const h = harness({ request: async (path, options) => { requests.push({ path, options }); return run({ status: "RUNNING" }); } });
  h.tracker.track(run(), "Launch campaign");
  assert.equal(h.state[0].campaignName, "Launch campaign");
  assert.equal(requests.length, 0);
  await h.tick();
  assert.equal(requests[0].path, "/api/qa-runs/run-1");
  assert.equal(requests[0].options.method, undefined);
  assert.equal(h.state[0].status, "RUNNING");
  assert.equal(h.timers.size, 1);
  h.tracker.stop();
});

test("refresh restores active checks and keeps completed notifications until dismissed", async () => {
  const first = harness();
  first.tracker.track(run(), "Launch campaign");
  first.tracker.stop();
  const restored = harness({ saved: first.persisted, request: async () => run({ status: "COMPLETED" }) });
  assert.equal(restored.state[0].campaignName, "Launch campaign");
  await restored.tick();
  assert.equal(restored.settled, 1);
  assert.equal(restored.state[0].status, "COMPLETED");
  assert.equal(restored.timers.size, 0);
  const finished = harness({ saved: restored.persisted });
  assert.equal(finished.state[0].status, "COMPLETED");
  assert.equal(finished.timers.size, 0);
  finished.tracker.dismiss("run-1");
  assert.deepEqual(JSON.parse(finished.persisted), []);
});

test("transient status errors reconnect without losing the check or treating it as failed", async () => {
  let attempt = 0;
  const h = harness({ request: async () => { if (++attempt === 1) throw error(503); return run({ status: "COMPLETED" }); } });
  h.tracker.track(run(), "Launch campaign");
  await h.tick();
  assert.ok(isQaActive(h.state[0]));
  assert.equal(h.state[0].connectionIssue, true);
  assert.equal(h.settled, 0);
  await h.tick();
  assert.equal(h.state[0].connectionIssue, false);
  assert.equal(h.state[0].status, "COMPLETED");
  assert.equal(h.settled, 1);
});

test("long checks continue polling beyond the previous 90-attempt limit", async () => {
  const h = harness();
  h.tracker.track(run(), "Launch campaign");
  for (let index = 0; index < 95; index++) await h.tick();
  assert.equal(h.state[0].status, "RUNNING");
  assert.equal(h.settled, 0);
  assert.equal(h.timers.size, 1);
  h.tracker.stop();
});

test("failed checks keep their error and notify once without automatically resubmitting", async () => {
  const h = harness({ request: async () => run({ status: "FAILED", errorMessage: "Inspection failed" }) });
  h.tracker.track(run(), "Launch campaign");
  await h.tick();
  assert.equal(h.state[0].errorMessage, "Inspection failed");
  assert.equal(h.settled, 1);
  assert.equal(h.timers.size, 0);
});

test("campaigns finish independently and stale list responses cannot restart completed checks", async () => {
  const h = harness({ request: async (path) => path.endsWith("run-1") ? run({ status: "COMPLETED" }) : run({ id: "run-2", campaignId: "campaign-2", status: "RUNNING" }) });
  h.tracker.track(run(), "First");
  h.tracker.track(run({ id: "run-2", campaignId: "campaign-2" }), "Second");
  h.tracker.dismiss("run-2");
  assert.equal(h.state.length, 2);
  await h.tick();
  h.tracker.track(run(), "Stale campaign response");
  assert.equal(h.state.find((item) => item.id === "run-1").status, "COMPLETED");
  assert.equal(h.state.find((item) => item.id === "run-2").status, "RUNNING");
  assert.equal(h.timers.size, 1);
  h.tracker.stop();
});

test("session expiry stops background polling and requests sign-in", async () => {
  const h = harness({ request: async () => { throw error(401); } });
  h.tracker.track(run(), "Launch campaign");
  await h.tick();
  assert.equal(h.expired, 1);
  assert.equal(h.timers.size, 0);
});

test("removed checks become unavailable instead of polling forever", async () => {
  const h = harness({ request: async () => { throw error(404); } });
  h.tracker.track(run(), "Launch campaign");
  await h.tick();
  assert.equal(h.state[0].status, "UNAVAILABLE");
  assert.equal(h.timers.size, 0);
});

test("sign-out aborts polling and prevents updates leaking into the next session", async () => {
  let finish, signal;
  const h = harness({ request: (_, options) => { signal = options.signal; return new Promise((resolve) => { finish = resolve; }); } });
  h.tracker.track(run(), "Launch campaign");
  const poll = h.tick();
  h.tracker.stop();
  const writes = h.writes;
  assert.equal(signal.aborted, true);
  finish(run({ status: "COMPLETED" }));
  await poll;
  assert.equal(h.writes, writes);
  assert.equal(h.settled, 0);
  assert.equal(h.timers.size, 0);
});

test("invalid or unavailable browser storage does not prevent a check", () => {
  for (const saved of ["broken JSON", "{}", '[null, {"id": 4}]']) assert.deepEqual(harness({ saved }).state, []);
  const h = harness({ storage: { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } } });
  h.tracker.track(run(), "Launch campaign");
  assert.equal(h.state.length, 1);
  h.tracker.stop();
});

test("tracked checks update matching reports without hiding newer server runs", () => {
  assert.equal(latestQaRun(run(), run({ status: "COMPLETED" })).status, "COMPLETED");
  const newer = run({ id: "run-2", createdAt: "2026-10-30T11:00:00Z" });
  assert.equal(latestQaRun(newer, run()).id, "run-2");
  assert.equal(latestQaRun(run(), newer).id, "run-2");
});
