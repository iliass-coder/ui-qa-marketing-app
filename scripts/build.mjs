import { readFile, writeFile } from "node:fs/promises";
import { build, createServer } from "vite";

// Render the same component used by the browser, so prices, FAQs, and copy cannot
// drift into a separate crawler-only version. The deployment still serves static files.
await build();
const renderer = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: "custom",
  mode: "production",
});
try {
  const { renderLandingPage } = await renderer.ssrLoadModule("/src/prerender.jsx");
  const year = new Date().getFullYear();
  const markup = renderLandingPage(year);
  const template = await readFile("dist/index.html", "utf8");
  const placeholder = '<div id="root"></div>';
  if (!template.includes(placeholder) || !markup.includes('id="landing-headline"')) {
    throw new Error("Homepage prerender failed: missing root placeholder or headline.");
  }
  await writeFile("dist/index.html", template.replace(placeholder,
    `<div id="root" data-prerendered="home" data-rendered-year="${year}">${markup}</div>`));
  console.log("Prerendered homepage: headline, product description, pricing, and FAQs are in the initial HTML.");
} finally {
  await renderer.close();
}
