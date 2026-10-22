import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.log("pageerror:", error.message));

const shot = async (name) => {
  await page.screenshot({ path: `artifacts/${name}.png` });
  console.log("shot:", name);
};

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="signin-minh"]', { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "artifacts/v-signin.png" });
console.log("shot: v-signin");
await page.click('[data-testid="signin-minh"]');
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForTimeout(1000);
await shot("v-home-top");

await page.locator('[data-testid="attack-panel"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await shot("v-home-mid");

// settlement flow
await page.click('[data-testid="persona-bay"]');
await page.waitForTimeout(450);
await page.click('[data-testid="claim-submit"]');
await page.waitForSelector('[data-testid="sig-row-minh"]', { timeout: 10000 });
await page.locator('[data-testid="settlement-panel"]').scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await shot("v-claim-pending");

await page.click('[data-testid="persona-minh"]');
await page.waitForTimeout(450);
await page.click('[data-testid="sign-minh"]');
await page.waitForTimeout(500);
await page.locator('[data-testid="settlement-panel"]').scrollIntoViewIfNeeded();
await shot("v-claim-1of2");

await page.click('[data-testid="persona-lan"]');
await page.waitForTimeout(450);
await page.click('[data-testid="sign-lan"]');
await page.waitForSelector('[data-testid="authority-banner"]', { timeout: 10000 });
await page.waitForTimeout(900);
await page.locator('[data-testid="settlement-panel"]').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -110));
await page.waitForTimeout(300);
await shot("v-settled");

await page.click('[data-testid="reset-demo"]');
await page.waitForSelector('[data-testid="claim-dispute"]', { timeout: 10000 });
await page.waitForTimeout(300);
await page.click('[data-testid="claim-dispute"]');
await page.waitForSelector('[data-testid="dispute-banner"]', { timeout: 10000 });
await page.waitForTimeout(900);
await page.evaluate(() => window.scrollBy(0, -110));
await shot("v-disputed");
console.log(
  "wallets:",
  await page
    .locator("[data-wallet-balance]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-wallet-balance"))),
);

// mobile viewport shots
const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await mobile.goto("http://localhost:3000", { waitUntil: "networkidle" });
await mobile.waitForSelector('[data-testid="signin-minh"]', { timeout: 20000 });
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: "artifacts/v-signin-mobile.png" });
await mobile.click('[data-testid="signin-minh"]');
await mobile.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await mobile.waitForTimeout(1000);
await mobile.screenshot({ path: "artifacts/v-mobile-top.png" });
await mobile.locator('[data-testid="settlement-panel"]').scrollIntoViewIfNeeded();
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: "artifacts/v-mobile-settlement.png" });
console.log("mobile shots done");

await browser.close();
