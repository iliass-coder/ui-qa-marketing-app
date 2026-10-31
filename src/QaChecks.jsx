import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons.jsx";
import { createQaTracker, isQaActive } from "./qaRuns.js";
import "./qa-checks.css";

export function useQaChecks({ scope, campaigns, request, onSettled, onExpired }) {
  const [state, setState] = useState({ scope: null, runs: [] });
  const tracker = useRef(null);
  const callbacks = useRef({ onSettled, onExpired });
  callbacks.current = { onSettled, onExpired };

  useEffect(() => {
    if (!scope) return undefined;
    let storage;
    try { storage = window.localStorage; } catch {}
    const current = createQaTracker({
      request, storage, storageKey: `clickcohere_qa_checks:${scope}`,
      onChange: (runs) => setState({ scope, runs }),
      onSettled: () => callbacks.current.onSettled?.(),
      onExpired: () => callbacks.current.onExpired?.(),
    });
    tracker.current = current;
    current.start();
    return () => { current.stop(); tracker.current = null; };
  }, [scope, request]);

  useEffect(() => {
    for (const item of campaigns || []) {
      if (isQaActive(item.lastQa)) tracker.current?.track(item.lastQa, item.campaign.name);
    }
  }, [campaigns, scope]);

  const track = useCallback((run, name) => tracker.current?.track(run, name), []);
  const dismiss = useCallback((id) => tracker.current?.dismiss(id), []);
  return { runs: state.scope === scope ? state.runs : [], track, dismiss };
}

function elapsedSeconds(run) {
  const start = Date.parse(run?.createdAt || run?.startedAt);
  return Number.isFinite(start) ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : 0;
}

function useElapsed(run) {
  const [seconds, setSeconds] = useState(() => elapsedSeconds(run));
  useEffect(() => {
    setSeconds(elapsedSeconds(run));
    const timer = window.setInterval(() => setSeconds(elapsedSeconds(run)), 1000);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.createdAt, run?.startedAt]);
  return seconds;
}

function duration(seconds) {
  return seconds < 60 ? `${seconds}s elapsed` : `${Math.floor(seconds / 60)}m ${seconds % 60}s elapsed`;
}

function Elapsed({ run }) {
  const seconds = useElapsed(run);
  return <span className="qa-elapsed" aria-live="off"><Icon name="clock" size={14} />{duration(seconds)}</span>;
}

export function QaNotifications({ runs, route, onDismiss }) {
  const visible = runs.filter((run) => !(isQaActive(run) && route.page === "report" && route.id === run.campaignId));
  if (!visible.length) return null;
  return <section className="qa-notifications" aria-label="Campaign checks">{visible.map((run) => {
    const active = isQaActive(run);
    const complete = run.status === "COMPLETED";
    return <div key={run.id} className={`qa-notification ${active ? "is-running" : complete ? "is-ready" : "is-failed"}`}>
      <span className="qa-notification-icon" aria-hidden="true">{active ? <span className="spinner" /> : <Icon name={complete ? "check" : "warning"} size={20} />}</span>
      <div className="qa-notification-copy"><strong role="status">{active ? run.connectionIssue ? "Reconnecting to your check…" : "Check running" : complete ? "Report ready" : run.status === "FAILED" ? "Check failed" : "Check unavailable"}</strong><span>{run.campaignName}</span></div>
      {active && <Elapsed run={run} />}
      <a className="button secondary qa-report-link" href={`#/report/${run.campaignId}`}>{active ? "View progress" : complete ? "View report" : "Review check"}<Icon name="arrow" size={14} /></a>
      {!active && <button type="button" className="icon-button qa-notification-dismiss" aria-label={`Dismiss check notification for ${run.campaignName}`} onClick={() => onDismiss(run.id)}><Icon name="close" size={17} /></button>}
    </div>;
  })}</section>;
}

export function QaProgress({ run, adCount }) {
  const seconds = useElapsed(run);
  return <section className="qa-progress" aria-labelledby="qa-progress-title">
    <div className="qa-progress-heading"><span className="qa-progress-icon" aria-hidden="true"><Icon name="shield" size={24} /></span><div><div className="eyebrow">CAMPAIGN CHECK IN PROGRESS</div><h2 id="qa-progress-title" aria-live="polite">{run.connectionIssue ? "Reconnecting to your check…" : "Checking your campaign…"}</h2></div></div>
    <p>{run.connectionIssue ? "Your check continues in the background. We're reconnecting to its status." : "We're reviewing your ads and landing pages. This report updates automatically when the check finishes."}</p>
    <div className="qa-progress-details"><span className="qa-elapsed" aria-live="off"><Icon name="clock" size={15} />{duration(seconds)}</span>{adCount > 0 && <span>{adCount} ad{adCount === 1 ? "" : "s"} in this campaign</span>}</div>
    {seconds >= 120 && <p className="qa-long-wait" role="status">This is taking longer than expected. The check is still running; you can return to this report later.</p>}
    <div className="qa-progress-footer"><Icon name="watch" size={17} /><span>You can keep working. We'll let you know here when your report is ready.</span><a href="#/campaigns" className="text-link">All campaigns<Icon name="arrow" size={14} /></a></div>
  </section>;
}
