# Published policies for ClickCohere

The final source files are in `public/`; the former drafts have been moved there and completed:

- [Privacy notice](https://www.clickcohere.com/privacy.html): `public/privacy.html`.
- [Terms of service](https://www.clickcohere.com/terms.html): `public/terms.html`.
- [Refunds and cancellation](https://www.clickcohere.com/refunds.html): `public/refunds.html`.

The operator is **Elamrani Technologies Inc., Canada**, as supplied by the owner. Account, billing, and privacy contact: `iliass.elamrani@outlook.com`. All three policies are effective October 25, 2026 and include canonical URLs, shared styling, navigation, and public GET access through Spring Security. Links appear in the landing-page footer, signup, Plan & usage, and support page.

Refunds are requested through support. Subscription refunds are proportional to unused time in the current paid billing period, including renewals; an earlier cancellation ends paid access. Portal cancellation by itself stops renewal at period end and does not issue a refund. Unused, unexpired purchased analysis credits are refundable in proportion to the pack price paid. Used time, used credits, and completed billing periods are excluded, subject to mandatory legal rights. The page includes calculation examples and explains that refunds are handled manually.

Publication was confirmed on October 25, 2026 at 18:17 UTC: deployment `dep-dbf4chqvcj2c73eprbmg`, commit `a06dbbd7f8f9f521acd6bfb9eb4e5f32cb6c1d4a`. All three public pages returned HTTP 200 and matched the release after normalizing Windows/Linux line endings. The stylesheet, support page, homepage, and matching frontend assets returned HTTP 200; API health was `UP`, and the unauthenticated account endpoint remained HTTP 401.

The frontend and Java 21 backend production builds passed. The three pages were rendered and checked at desktop (1440px) and mobile (390px) widths, including footer links and horizontal overflow. No test suite was run. Deployment and live-check records are in `deployment/.private/policies-deploy.json` and `policies-live-check.json`; visual checks are in `deployment/.private/policy-previews/`.
