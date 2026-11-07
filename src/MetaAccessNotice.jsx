import React from "react";

export const META_ACCESS_SUMMARY = "Standard checks use read access to your ad accounts, campaigns, ads, and destinations (ads_read). The current authorization also requests ads_management, which is required only for optional campaign pausing. Disconnect the saved connection in Settings → Meta Ads → Disconnect.";

export function MetaAccessNotice({ compact = false }) {
  return <p className={`meta-access-notice${compact ? " is-compact" : ""}`}><strong>Meta access.</strong> {META_ACCESS_SUMMARY}</p>;
}
