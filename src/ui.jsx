import React from "react";
import { Icon } from "./icons.jsx";
import { statusTone } from "./domain.js";

export function Button({ children, icon, kind = "secondary", className = "", ...props }) {
  return <button className={`button ${kind} ${className}`} {...props}>{icon && <Icon name={icon} size={16} />}{children}</button>;
}

export function Status({ value, label }) {
  const raw = label || value || "Not checked";
  const labels = { STALE: "Out of date", PASS: "Passed", FAIL: "Needs action", WARNING: "Review needed", UNKNOWN: "Not checked", OPEN: "Open", CONNECTED: "Connected", RESOLVED: "Resolved", INTENTIONAL: "Accepted", REVERTED: "Restored" };
  const text = labels[raw] || (/^[A-Z][A-Z_]+$/.test(raw) ? raw.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : raw);
  return <span className={`status ${statusTone(value)}`}><span className="status-dot" aria-hidden="true" />{text}</span>;
}

export function Empty({ title, children, action }) {
  return <div className="empty-state"><span className="empty-mark"><Icon name="shield" size={25} /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function PageHeading({ eyebrow, title, children, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children && <p>{children}</p>}</div>{action && <div className="heading-actions">{action}</div>}</div>;
}
