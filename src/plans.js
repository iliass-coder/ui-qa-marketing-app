// Public copy mirrors the server's Plan catalog; authenticated limits come from /api/billing.
export const PLANS = [
  { id: "FREE", name: "Free Preview", price: 0, accounts: 1, pages: 3, analyses: 10, interval: 60, description: "Meet your next campaign with a clearer picture.", cta: "Start your free preview", note: "No credit card. No automatic charge." },
  { id: "STARTER", name: "Starter", price: 39, accounts: 1, pages: 5, analyses: 100, interval: 30, description: "A steady watch for your brand's essential pages.", cta: "Choose Starter", note: "For one brand and its next launch." },
  { id: "GROWTH", name: "Growth", price: 99, accounts: 3, pages: 25, analyses: 500, interval: 30, description: "More campaigns moving. One clear view.", cta: "Choose Growth", note: "Room for a growing campaign portfolio.", featured: true },
];
export const AGENCY = { price: 249, accounts: 10, pages: 100, analyses: 2000 };

export function planFeatures(plan) {
  return [
    `${plan.accounts} Meta ad account${plan.accounts === 1 ? "" : "s"}`,
    `${plan.analyses.toLocaleString()} ad analyses${plan.id === "FREE" ? " total" : " / month"}`,
    `${plan.pages} monitored landing pages${plan.id === "FREE" ? " for 14 days" : ""}`,
    `Inspections every ${plan.interval} minutes`,
    "Complete findings and source evidence",
    "Incident alerts and optional campaign pausing",
  ];
}
