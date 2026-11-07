import React, { useEffect, useState } from "react";
import { Icon } from "./icons.jsx";
import { campaignPhase, formatDate, statusTone } from "./domain.js";
import { Button, Empty, PageHeading, Status } from "./ui.jsx";
import { INCIDENT_REPORT_LIMIT, incidentReportHref, issueCategory, issueCounts, issueTitle, issueValue, safePageUrl, watchState } from "./incidents.js";
import "./monitoring.css";

function CategoryGuide({ preferences }) {
  const automatic = preferences?.autoPauseCampaignOnWebsiteDown && !preferences?.autoPauseSimulation;
  return <div className="issue-guide">
    <p><span className="issue-kind incident">Incident</span><span>HTTP 404, 410 or 5xx. Can pause a campaign after confirmation.</span></p>
    <p><span className="issue-kind warning">Warning</span><span>Something to review. Never pauses campaigns.</span></p>
    <a href="#/settings" className="issue-auto-setting">Automatic pausing: <strong>{automatic ? "On" : "Off"}</strong><Icon name="arrow" size={13} /></a>
  </div>;
}

function IssueCard({ issue, campaignName, busy, actOnIncident }) {
  const incident = issueCategory(issue) === "INCIDENT";
  const open = issue.status === "OPEN";
  const accepted = issue.status === "INTENTIONAL";
  const qa = issue.source === "QA" || issue.type?.startsWith("qa:");
  const url = safePageUrl(issue.evidenceJson?.url);
  const grammar = issue.type?.startsWith("qa:copy_quality:") ? issue.newValue?.value?.issues || [] : [];
  const showValues = !["content", "availability", "inspection"].includes(issue.type) && !qa;
  return <article className={`monitoring-issue ${incident ? "is-incident" : "is-warning"} ${open ? "" : "is-history"}`}>
    <div className="issue-card-top"><div className="issue-card-title"><span className={`issue-kind ${incident ? "incident" : "warning"}`}>{incident ? "Incident" : "Warning"}</span><h3>{issueTitle(issue)}</h3></div>{!open && <Status value={issue.status} />}</div>
    {campaignName && <p className="issue-campaign-name">{campaignName}</p>}
    {qa && issue.evidenceJson?.adName && <p className="issue-campaign-name">Ad: {issue.evidenceJson.adName}</p>}
    <p className="issue-description">{issue.description || issue.title}</p>
    {url && <a className="issue-url" href={url} target="_blank" rel="noreferrer">{url}</a>}
    <div className={`issue-pause-effect ${issue.pauseState === "PAUSED_AUTOMATICALLY" ? "is-paused" : ""}`}><Icon name={incident ? "shield" : "check"} size={16} /><div><strong>{incident ? issue.pauseLabel || "Needs confirmation" : "Alerts only — never pauses campaigns"}</strong>{incident && issue.pauseExplanation && <p>{issue.pauseExplanation}</p>}</div></div>
    {accepted && <p className="issue-accepted-note">{issue.blocksAutomaticPause ? "An existing setting prevents automatic pausing for this campaign. Restore alerts to remove this exception." : "Accepted until you restore alerts. Other warnings and outage incidents stay active."}</p>}
    {issue.resolutionNote && !accepted && <p className="issue-resolution-note">{issue.resolutionNote}</p>}
    {(showValues || grammar.length > 0 || issue.evidenceJson?.errorCode || qa) && <details className="issue-details"><summary>View details</summary>
      {showValues && <dl><div><dt>Before</dt><dd>{issueValue(issue, issue.oldValue)}</dd></div><div><dt>Now</dt><dd>{issueValue(issue, issue.newValue)}</dd></div></dl>}
      {issue.evidenceJson?.errorCode && <p>Check result: {String(issue.evidenceJson.errorCode).toLowerCase().replaceAll("_", " ")}{issue.evidenceJson.httpStatus ? ` · HTTP ${issue.evidenceJson.httpStatus}` : ""}</p>}
      {grammar.length > 0 && <ul>{grammar.map((finding, index) => <li key={index}><del>{finding.original_text}</del> → <ins>{finding.correction}</ins><p>{finding.explanation}</p></li>)}</ul>}
      {qa && <p>From the last campaign check. Run a new campaign check to refresh this finding.</p>}
    </details>}
    <div className="issue-card-footer"><span>{qa ? "Campaign check" : "Page check"} · {formatDate(issue.lastSeenAt || issue.createdAt)}</span><div className="issue-card-actions">
      {qa && issue.campaignId ? <a className="button secondary" href={`#/report/${issue.campaignId}`}>View campaign check<Icon name="arrow" size={13} /></a> : open && <Button icon="refresh" disabled={Boolean(busy)} onClick={() => actOnIncident(issue, "recheck")}>{busy === `incident:${issue.id}` ? "Checking…" : "Recheck"}</Button>}
      {open && !incident && <Button disabled={Boolean(busy)} onClick={() => actOnIncident(issue, "mark-intentional")}>Accept warning</Button>}
      {accepted && <Button disabled={Boolean(busy)} onClick={() => actOnIncident(issue, "revert-intentional")}>Restore alerts</Button>}
    </div></div>
  </article>;
}

function IssueList({ issues, campaignNames, busy, actOnIncident }) {
  return <div className="monitoring-issue-list">{["INCIDENT", "WARNING"].map((category) => {
    const records = issues.filter((issue) => issueCategory(issue) === category);
    if (!records.length) return null;
    return <section className="issue-category-section" key={category} aria-label={category === "INCIDENT" ? "Incidents" : "Warnings"}>
      <div className="issue-section-heading"><h2>{category === "INCIDENT" ? "Incidents" : "Warnings"}</h2><span>{records.length}</span></div>
      {records.map((issue) => <IssueCard key={issue.id} issue={issue} campaignName={campaignNames?.get(issue.campaignId)} busy={busy} actOnIncident={actOnIncident} />)}
    </section>;
  })}</div>;
}

export function SiteWatch({ data, selectedCampaignId, busy, checkCampaign, monitorCampaign, actOnIncident, request }) {
  const campaigns = data.campaigns || [];
  const watched = campaigns.filter((item) => item.monitoringEnabled);
  const [selectedId, setSelectedId] = useState(selectedCampaignId || "");
  const [detail, setDetail] = useState({ id: "", loading: true, destinations: [], error: "" });
  const selected = watched.find((item) => item.campaign.id === selectedId);
  const issues = data.incidents || [];
  const counts = issueCounts(issues);
  const selectedIssues = issues.filter((issue) => issue.campaignId === selectedId && issue.status === "OPEN");
  const selectedCounts = issueCounts(selectedIssues);
  const state = watchState(selected, selectedIssues, data.billing);
  useEffect(() => { if (selectedCampaignId) setSelectedId(selectedCampaignId); }, [selectedCampaignId]);
  useEffect(() => { if (!watched.some((item) => item.campaign.id === selectedId)) setSelectedId(watched[0]?.campaign.id || ""); }, [campaigns, selectedId]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let active = true;
    setDetail({ id: selected.campaign.id, loading: true, destinations: [], error: "" });
    request(`/api/campaigns/${selected.campaign.id}/monitoring`, { signal: controller.signal }).then((result) => {
      if (active) setDetail({ ...result, id: selected.campaign.id, loading: false, error: "" });
    }).catch((error) => { if (active) setDetail({ id: selected.campaign.id, loading: false, destinations: [], error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [selected?.campaign.id, selected?.lastMonitoringAt, request]);
  return <>
    <PageHeading eyebrow="CONTINUOUS MONITORING" title="Campaign watch" action={<a className="button secondary" href={incidentReportHref()}>Incidents & warnings<Icon name="arrow" size={15} /></a>}>See what needs attention and whether it can pause your campaign.</PageHeading>
    <CategoryGuide preferences={data.preferences} />
    <div className="watch-summary"><div><strong>{watched.length}</strong><span>Campaigns on watch</span></div><a href={incidentReportHref({ category: "INCIDENT", status: "OPEN" })} className={counts.incidents ? "has-incidents" : ""}><strong>{counts.incidents}</strong><span>Open incidents</span></a><a href={incidentReportHref({ category: "WARNING", status: "OPEN" })} className={counts.warnings ? "has-warnings" : ""}><strong>{counts.warnings}</strong><span>Open warnings</span></a></div>
    <div className="watch-layout simple-watch">
      <section className="panel sites-panel"><div className="panel-heading"><div><h2>Your watches</h2><p>{data.billing?.monitoringActive ? `Every ${data.billing.monitoringIntervalMinutes} minutes` : "Coverage paused"}</p></div></div>
        {!watched.length ? <Empty title="No campaigns on watch">Start a watch from Campaigns to keep checking its current landing pages.</Empty> : <div className="site-list">{watched.map((item) => {
          const campaignIssues = issues.filter((issue) => issue.campaignId === item.campaign.id && issue.status === "OPEN");
          const campaignState = watchState(item, campaignIssues, data.billing);
          const campaignCounts = issueCounts(campaignIssues);
          return <button key={item.campaign.id} className={`site-option ${item.campaign.id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(item.campaign.id)} aria-pressed={item.campaign.id === selectedId}><span className={`watch-state ${statusTone(campaignState.value)}`}><Icon name={campaignIssues.length ? "warning" : "watch"} size={18} /></span><span className="site-option-main"><strong>{item.campaign.name}</strong><small>{campaignCounts.incidents || campaignCounts.warnings ? `${campaignCounts.incidents} incidents · ${campaignCounts.warnings} warnings` : campaignState.label}</small></span><Icon name="chevron" size={14} /></button>;
        })}</div>}
      </section>
      <section className="panel site-detail-panel">
        {!selected ? <Empty title="Choose a campaign">Select a watch to see its landing pages, incidents and warnings.</Empty> : <>
          <div className="site-detail-head"><div><div className="eyebrow">CAMPAIGN WATCH</div><h2>{selected.campaign.name}</h2><p>Meta status: {campaignPhase(selected.campaign)}</p></div><Status value={state.value} label={state.label} /></div>
          <div className="site-timing"><div><span>Last checked</span><strong>{formatDate(selected.lastMonitoringAt)}</strong></div><div><span>Next check</span><strong>{data.billing?.monitoringActive ? formatDate(selected.nextMonitoringAt) : "Coverage paused"}</strong></div></div>
          <div className="site-actions"><Button kind="primary" icon="refresh" disabled={Boolean(busy)} onClick={() => checkCampaign(selected.campaign.id)}>{busy === `campaign-monitor:${selected.campaign.id}` ? "Checking…" : "Check pages now"}</Button><Button disabled={Boolean(busy)} onClick={() => monitorCampaign(selected.campaign.id, false)}>Stop watch</Button></div>
          <section className="watch-current-issues"><div className="issue-section-heading"><h2>Needs attention</h2><a className="text-link" href={incidentReportHref({ campaignId: selectedId, status: "HISTORY" })}>View history<Icon name="arrow" size={13} /></a></div>
            {selectedIssues.length ? <><p className="watch-issues-caption">{selectedCounts.incidents} incidents · {selectedCounts.warnings} warnings</p><IssueList issues={selectedIssues} busy={busy} actOnIncident={actOnIncident} /></> : <p className="watch-clear-note"><Icon name="check" size={17} />{selected.lastMonitoringAt ? "No open incidents or warnings." : "Waiting for the first page check."}</p>}
          </section>
          <section className="history-section watch-destinations"><div className="section-heading"><h3>Landing pages</h3><span>Refreshed from Meta before each check</span></div>
            {detail.id !== selectedId || detail.loading ? <p className="muted-copy" role="status">Loading pages…</p> : detail.error ? <p className="alert error" role="alert">{detail.error}</p> : !detail.destinations.length ? <p className="muted-copy">No destination URL is currently available.</p> : detail.destinations.map((destination) => {
              const url = safePageUrl(destination.url);
              const pageIssues = selectedIssues.filter((issue) => issue.evidenceJson?.url === destination.url);
              const pageCounts = issueCounts(pageIssues);
              const snapshot = destination.latestSnapshot;
              const label = pageCounts.incidents ? "Incident" : pageCounts.warnings ? "Warning" : snapshot?.status === "PASS" ? "Page reachable" : snapshot ? "Could not verify" : "Not checked";
              const value = pageCounts.incidents ? "FAIL" : pageCounts.warnings ? "WARNING" : snapshot?.status || "UNKNOWN";
              return <div key={destination.url} className="watch-destination"><div>{url ? <a href={url} target="_blank" rel="noreferrer">{destination.url}</a> : <span>{destination.url}</span>}<small>{destination.ads?.length ? `Used by ${destination.ads.join(", ")}` : "Current campaign destination"}{snapshot?.httpStatus ? ` · HTTP ${snapshot.httpStatus}` : ""}</small></div><Status value={value} label={label} /></div>;
            })}
          </section>
        </>}
      </section>
    </div>
  </>;
}

export function IncidentReport({ data, route, busy, actOnIncident, request }) {
  const campaignId = route.campaignId || "";
  const category = route.category || "";
  const status = route.status || "OPEN";
  const history = status !== "OPEN";
  const [version, setVersion] = useState(0);
  const [report, setReport] = useState({ path: "", loading: true, issues: [], error: "" });
  const params = new URLSearchParams({ status });
  if (campaignId) params.set("campaignId", campaignId);
  if (category) params.set("category", category);
  if (route.type) params.set("type", route.type);
  const path = `/api/incidents/report?${params}`;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setReport({ path, loading: true, issues: [], error: "" });
    request(path, { signal: controller.signal }).then((issues) => { if (active) setReport({ path, loading: false, issues, error: "" }); })
      .catch((error) => { if (active) setReport({ path, loading: false, issues: [], error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [path, version, data.incidents, request]);
  const campaignNames = new Map((data.campaigns || []).map((item) => [item.campaign.id, item.campaign.name]));
  for (const issue of data.incidents || []) if (issue.campaignId && !campaignNames.has(issue.campaignId)) campaignNames.set(issue.campaignId, "Previous campaign");
  const loading = report.path !== path || report.loading;
  const change = (values) => { window.location.hash = incidentReportHref({ campaignId, category, status, ...values }); };
  return <>
    <PageHeading eyebrow="MONITORING" title="Incidents & warnings" action={<a className="button secondary" href="#/site-watch"><Icon name="watch" size={16} />Campaign watch</a>}>Incidents can pause campaigns. Warnings help you review changes.</PageHeading>
    <CategoryGuide preferences={data.preferences} />
    <section className="panel simple-issue-report">
      <div className="issue-report-toolbar"><div className="issue-view-switch" role="group" aria-label="Show open issues or history"><button type="button" className={!history ? "selected" : ""} aria-pressed={!history} onClick={() => change({ status: "OPEN" })}>Open</button><button type="button" className={history ? "selected" : ""} aria-pressed={history} onClick={() => change({ status: "HISTORY" })}>History</button></div><Button icon="refresh" disabled={loading || Boolean(busy)} onClick={() => setVersion((current) => current + 1)}>Refresh</Button></div>
      <div className="issue-report-controls"><div className="issue-category-tabs" role="group" aria-label="Issue category">{[{ value: "", label: "All" }, { value: "INCIDENT", label: "Incidents" }, { value: "WARNING", label: "Warnings" }].map((option) => <button type="button" key={option.value} className={category === option.value ? "selected" : ""} aria-pressed={category === option.value} onClick={() => change({ category: option.value })}>{option.label}</button>)}</div><label className="issue-campaign-filter"><span className="sr-only">Campaign</span><select aria-label="Campaign" value={campaignId} onChange={(event) => change({ campaignId: event.target.value })}><option value="">All campaigns</option>{[...campaignNames].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div>
      {route.type && <p className="issue-legacy-filter">Showing a previously linked finding. <a href={incidentReportHref({ campaignId, category, status })}>Show all findings</a></p>}
      <p className="issue-report-count" role="status">{loading ? "Loading…" : report.error ? "Could not load the report." : `${report.issues.length} ${history ? "past" : "open"} ${report.issues.length === 1 ? "issue" : "issues"}${report.issues.length === INCIDENT_REPORT_LIMIT ? " · showing the 50 most recent matches" : ""}`}</p>
      {loading ? <div className="center-state inline"><div className="spinner" /><p>Loading issues…</p></div> : report.error ? <div className="alert error" role="alert"><span>{report.error}</span><Button onClick={() => setVersion((current) => current + 1)}>Try again</Button></div> : !report.issues.length ? <Empty title={history ? "No history yet" : "Nothing needs attention"}>{history ? "Resolved incidents and accepted warnings will appear here." : "No open issues match this view. New findings will appear after a check."}</Empty> : <IssueList issues={report.issues} campaignNames={campaignNames} busy={busy} actOnIncident={actOnIncident} />}
    </section>
  </>;
}
