import React, { useEffect, useState } from "react";
import { analyticsChoice, chooseAnalytics, startAnalytics } from "./analytics.js";
import "./analytics.css";

export function AnalyticsConsent() {
  const [enabled, setEnabled] = useState(false);
  const [choice, setChoice] = useState(analyticsChoice);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    startAnalytics().then((config) => { if (active) setEnabled(Boolean(config.enabled)); });
    const changed = () => setChoice(analyticsChoice());
    window.addEventListener("steadysignal-analytics-choice", changed);
    return () => { active = false; window.removeEventListener("steadysignal-analytics-choice", changed); };
  }, []);
  if (!enabled) return null;
  const choose = (value) => { chooseAnalytics(value); setOpen(false); };
  if (choice && !open) return <button className="analytics-preferences" onClick={() => setOpen(true)}>Privacy choices</button>;
  return <section className="analytics-consent" aria-label="Optional analytics">
    <div><strong>Help us improve Click Cohere</strong><p>Allow optional browser analytics to understand visits and improve the website. You can change your choice anytime. <a href="/privacy.html">Privacy notice</a></p></div>
    <div className="analytics-consent-actions"><button className="button secondary" onClick={() => choose("deny")}>Decline</button><button className="button primary" onClick={() => choose("allow")}>Allow analytics</button></div>
  </section>;
}
