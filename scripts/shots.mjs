import { promises as fs } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
await fs.mkdir("docs", { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});

async function fonts() {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(500);
}

async function scrollTo(selector, offset = 88) {
  await page.evaluate(
    ({ selector, offset }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`missing ${selector}`);
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "instant" });
    },
    { selector, offset },
  );
  await page.waitForTimeout(500);
}

// 1. Sign-in screen: the judge quick-login box is open by default.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="signin"]', { timeout: 20000 });
await fonts();
await page.screenshot({ path: "docs/signin.png" });
console.log("captured docs/signin.png");

// 2. Dashboard hero, signed in as the lead tenant.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.click('[data-testid="signin-minh"]');
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="settlement-panel"]', {
  timeout: 20000,
});
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await fonts();
await page.screenshot({ path: "docs/screenshot.png" });
console.log("captured docs/screenshot.png");

// 3. Blocked unilateral withdrawal, captured as its own panel.
await scrollTo('[data-testid="attack-panel"]');
await page.click('[data-testid="attack-minh"]');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="attack-panel"]')
      ?.textContent?.includes("TIDECLOAK_EMERGENT_AUTHORITY_MISSING"),
  { timeout: 20000 },
);
await page.locator('[data-testid="attack-panel"]').screenshot({
  path: "docs/blocked.png",
});
console.log("captured docs/blocked.png");

// 4. Data protection: owner form, local reveal, server-view ciphertext.
await scrollTo('[data-testid="data-panel"]');
await page.click('[data-testid="pii-save"]');
await page.waitForFunction(
  () => {
    const panel = document.querySelector('[data-testid="data-panel"]');
    return (
      panel?.textContent?.includes("stored as ciphertext") &&
      panel?.textContent?.includes("ENC_TIDE_v1:")
    );
  },
  { timeout: 20000 },
);
await page.click('[data-testid="pii-reveal"]');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="data-panel"]')
      ?.textContent?.includes("Decrypted locally"),
  { timeout: 20000 },
);
await page.waitForTimeout(400);
await page.locator('[data-testid="data-panel"]').screenshot({
  path: "docs/encryption.png",
});
console.log("captured docs/encryption.png");

await browser.close();
