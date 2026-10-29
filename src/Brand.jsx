import React from "react";

export function BrandIcon({ size = 32, className }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M17 8a7 7 0 1 0 0 10M25 14a7 7 0 1 0 0 10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>;
}

export function Brand() {
  return <div className="brand"><span className="brand-mark"><BrandIcon /></span><span className="brand-name">Click <span>Cohere</span><small>CAMPAIGN ASSURANCE</small></span></div>;
}
