import React from "react";

export const SUPPORT_EMAIL = "support@clickcohere.com";

export function SupportLink({ children = SUPPORT_EMAIL, subject = "Click Cohere support", ...props }) {
  return <a {...props} href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`}>{children}</a>;
}
