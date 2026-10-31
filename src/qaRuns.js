export const isQaActive = (run) => ["QUEUED", "RUNNING"].includes(run?.status);

export function latestQaRun(serverRun, trackedRun) {
  if (!trackedRun) return serverRun;
  return !serverRun || serverRun.id === trackedRun.id || Date.parse(trackedRun.createdAt) > Date.parse(serverRun.createdAt)
    ? trackedRun : serverRun;
}

// Keep each member's pending checks and unread outcomes through a page refresh.
export function createQaTracker({ request, storage, storageKey, onChange, onSettled, onExpired,
  schedule = setTimeout, cancel = clearTimeout }) {
  let runs = [];
  let stopped = true;
  let timer = null;
  let controller = null;
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || "[]");
    if (Array.isArray(saved)) runs = saved.filter((run) => run && typeof run.id === "string"
      && typeof run.campaignId === "string" && typeof run.campaignName === "string"
      && ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "UNAVAILABLE"].includes(run.status))
      .map((run) => ({ ...run, connectionIssue: false }));
  } catch {}

  const publish = () => {
    try { storage?.setItem(storageKey, JSON.stringify(runs)); } catch {}
    onChange([...runs]);
  };
  const queue = (delay = 2500) => {
    if (stopped || controller || timer !== null || !runs.some(isQaActive)) return;
    timer = schedule(poll, delay);
  };
  const poll = async () => {
    timer = null;
    if (stopped) return;
    const pending = runs.filter(isQaActive);
    const polling = new AbortController();
    controller = polling;
    const outcomes = await Promise.allSettled(pending.map((run) =>
      request(`/api/qa-runs/${encodeURIComponent(run.id)}`, { signal: polling.signal })));
    if (stopped) return;
    let settled = false;
    let expired = false;
    pending.forEach((run, index) => {
      const outcome = outcomes[index];
      let update;
      if (outcome.status === "fulfilled" && ["QUEUED", "RUNNING", "COMPLETED", "FAILED"].includes(outcome.value?.status)) {
        update = { ...outcome.value, connectionIssue: false };
        settled ||= !isQaActive(update);
      } else {
        const status = outcome.reason?.status;
        if (status === 401) expired = true;
        update = [403, 404].includes(status)
          ? { status: "UNAVAILABLE", errorMessage: "This check is no longer available. Open the campaign to review its latest report.", connectionIssue: false }
          : { connectionIssue: true };
        settled ||= update.status === "UNAVAILABLE";
      }
      runs = runs.map((current) => current.id === run.id
        ? { ...current, ...update, id: current.id, campaignId: current.campaignId } : current);
    });
    controller = null;
    if (expired) {
      stopped = true;
      onExpired?.();
      return;
    }
    publish();
    if (settled) onSettled?.();
    queue();
  };

  return {
    start() { stopped = false; publish(); queue(0); },
    stop() { stopped = true; if (timer !== null) cancel(timer); timer = null; controller?.abort(); },
    track(run, campaignName = "Campaign") {
      if (stopped || !run?.id || !run.campaignId) return;
      const current = runs.find((item) => item.id === run.id);
      // A stale campaign-list response must not turn a finished check back into a running one.
      if (current) return;
      runs = [{ ...run, campaignName, createdAt: run.createdAt || new Date().toISOString(), connectionIssue: false }, ...runs];
      publish();
      queue(0);
    },
    dismiss(id) {
      runs = runs.filter((run) => run.id !== id || isQaActive(run));
      publish();
    },
  };
}
