import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
page.on("console", (message) => {
  if (message.type() === "error") console.log("console.error:", message.text());
});
page.on("pageerror", (error) => console.log("pageerror:", error.message));

const shot = async (name, options = {}) => {
  await page.screenshot({ path: `artifacts/${name}.png`, ...options });
  console.log("shot:", name);
};

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="signin-minh"]', { timeout: 20000 });
await page.click('[data-testid="signin-minh"]');
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForTimeout(1200);
await shot("home", { fullPage: true });

// 1. Lead tenant unilateral withdrawal
await page.click('[data-testid="attack-minh"]');
await page.waitForTimeout(350);
await shot("blocked-withdraw", { fullPage: true });
console.log(
  "console 1:",
  (await page.locator('[data-testid="attack-panel"]').innerText()).slice(-220),
);

// 2. Landlord force deduct
await page.click('[data-testid="persona-bay"]');
await page.waitForTimeout(450);
await page.click('[data-testid="attack-bay"]');
await page.waitForTimeout(350);
await shot("blocked-deduct", { fullPage: true });

// 3. File the $150 claim
await page.click('[data-testid="claim-submit"]');
await page.waitForSelector('[data-testid="sig-row-minh"]', { timeout: 10000 });
await page.waitForTimeout(300);
await shot("claim-pending", { fullPage: true });

// 4. Tenant 1 signs
await page.click('[data-testid="persona-minh"]');
await page.waitForTimeout(450);
await page.click('[data-testid="sign-minh"]');
await page.waitForTimeout(500);
await shot("claim-1of2", { fullPage: true });
console.log(
  "progress:",
  (await page.locator('[data-testid="settlement-panel"]').innerText()).slice(-260),
);

// 5. Tenant 2 signs -> emergent authority
await page.click('[data-testid="persona-lan"]');
await page.waitForTimeout(450);
await page.click('[data-testid="sign-lan"]');
await page.waitForSelector('[data-testid="authority-banner"]', { timeout: 10000 });
await page.waitForTimeout(1200);
await shot("settled", { fullPage: true });
console.log(
  "wallets:",
  await page
    .locator("[data-wallet-balance]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-wallet-balance"))),
);

// 6. Dispute scenario after reset
await page.click('[data-testid="reset-demo"]');
await page.waitForSelector('[data-testid="claim-dispute"]', { timeout: 10000 });
await page.waitForTimeout(300);
await page.click('[data-testid="claim-dispute"]');
await page.waitForSelector('[data-testid="dispute-banner"]', { timeout: 10000 });
await page.waitForTimeout(900);
await shot("disputed", { fullPage: true });
console.log(
  "wallets after dispute:",
  await page
    .locator("[data-wallet-balance]")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-wallet-balance"))),
);

// 7. Mobile
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await mobile.goto("http://localhost:3000", { waitUntil: "networkidle" });
await mobile.waitForSelector('[data-testid="signin-minh"]', { timeout: 20000 });
await mobile.click('[data-testid="signin-minh"]');
await mobile.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: "artifacts/mobile.png", fullPage: true });

await browser.close();
