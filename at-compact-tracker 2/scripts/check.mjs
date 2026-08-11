import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const url = process.argv[2] || "http://localhost:8843/index.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push("pageerror: " + err.message));

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Basic assertions
const statTiles = await page.locator(".stat-tile").count();
const tableRows = await page.locator("#bill-tbody tr").count();
const mapPaths = await page.locator(".state-shape").count();
const updatedText = await page.locator("#updated-at").textContent();

console.log("stat tiles:", statTiles);
console.log("table rows:", tableRows);
console.log("map paths:", mapPaths);
console.log("updated text:", updatedText);

// click a state, verify detail panel updates
if (mapPaths > 0) {
  // South Dakota should be enacted in sample data — find by hovering all and clicking one with fill != gray
  await page.locator(".state-shape").nth(10).click();
  await page.waitForTimeout(300);
}
const detailHtml = await page.locator("#detail").innerHTML();
console.log("detail panel non-empty:", detailHtml.length > 50);

// toggle dark mode
await page.locator("#theme-toggle").click();
await page.waitForTimeout(300);
const themeAttr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
console.log("theme after toggle:", themeAttr);

await page.screenshot({ path: "/home/claude/at-compact-tracker/screenshot-light.png", fullPage: true });
await page.locator("#theme-toggle").click(); // -> dark
await page.waitForTimeout(300);
await page.screenshot({ path: "/home/claude/at-compact-tracker/screenshot-dark.png", fullPage: true });

console.log("console/page errors:", JSON.stringify(errors, null, 2));

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
