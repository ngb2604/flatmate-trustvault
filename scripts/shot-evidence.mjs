import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
await page.goto("http://localhost:3000/evidence/broken-faucet.svg", { waitUntil: "networkidle" });
await page.screenshot({ path: "artifacts/evidence.png" });
await browser.close();
