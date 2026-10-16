# SteadySignal — complete Figma website prototype

Import this folder into **Figma Desktop** using `Plugins → Development → Import plugin from manifest…` and choose `manifest.json`. Then run **SteadySignal — Complete product design** from the Development menu. The plugin creates six native, editable desktop screens on the current page.

## Screens and flows

- **Connect account:** first-use setup explains the Meta connection and one-minute page checks, with optional campaign pause automation on confirmed outages.
- **Overview:** campaign queue, QA findings, and site-watch status.
- **Campaigns:** launch queue with prelaunch and live states.
- **QA report:** ad creative and landing page shown side by side, with the mismatch and a suggested fix.
- **Site watch:** monitored destinations, response times, and a recent slowdown timeline.
- **Settings:** Meta connection, monitoring cadence, and alert preferences.

The left navigation, overview actions, campaign actions, QA return action, and settings link are wired for Figma Present mode. Start on the **Overview** frame. Sample campaign and monitoring data are illustrative; there is no live Meta or website connection.

The palette and visual system follow the supplied reference: blue-teal rail, warm ivory canvas, serif display headings, coral primary actions, and muted green/amber states. No gradients, external images, or network requests are used. Dynamic page access is enabled in the manifest; no build step or package installation is required.
