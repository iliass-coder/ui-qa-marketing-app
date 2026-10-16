import React from "react";

const paths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.7" /><rect x="14" y="3" width="7" height="7" rx="1.7" /><rect x="3" y="14" width="7" height="7" rx="1.7" /><rect x="14" y="14" width="7" height="7" rx="1.7" /></>,
  campaigns: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  watch: <><path d="M3 12h4l3-8 4 16 3-8h4" /></>,
  settings: <><path d="M4 7h8m4 0h4M4 17h4m4 0h8" /><circle cx="14" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  logout: <><path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h12" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  warning: <><path d="m10.3 4.5-8 14a1 1 0 0 0 .9 1.5h17.6a1 1 0 0 0 .9-1.5l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 3h.01" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  link: <><path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 1)" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  meta: <path d="M12 10.5C9.5 6 8.5 4 6.5 4 3 4 1.5 10 1.5 14s1.5 5 3.5 5c3 0 5.5-6.5 7-8.5C14.5 6 15.5 4 17.5 4 21 4 22.5 10 22.5 14s-1.5 5-3.5 5c-3 0-5.5-6.5-7-8.5Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
};

export function Icon({ name, size = 20, className = "", ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`icon ${className}`} {...props}>{paths[name] || paths.shield}</svg>;
}
