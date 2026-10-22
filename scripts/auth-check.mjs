import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

const scope = () =>
  page.getAttribute('[data-testid="session-token"]', "data-scope");

await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="signin-minh"]', { timeout: 20000 });
assert.equal(
  await page.locator('[data-testid="vault-panel"]').count(),
  0,
  "vault must be inaccessible before sign-in",
);

// Landlord: can file, cannot move funds.
await page.click('[data-testid="signin-bay"]');
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForTimeout(400);
assert.equal(await scope(), "openid tide.vault.read tide.claim.file");
assert.equal(await page.locator('[data-testid="claim-submit"]').count(), 1);
assert.match(
  await page.locator('[data-testid="session-access"]').innerText(),
  /file claims/,
);
assert.match(
  await page.locator('[data-testid="session-access"]').innerText(),
  /no fund access/,
);
console.log("landlord access: file claims, no fund access");

// Sign-out clears the dashboard gate.
await page.click('[data-testid="sign-out"]');
await page.waitForSelector('[data-testid="signin-minh"]', { timeout: 10000 });
assert.equal(await page.locator('[data-testid="vault-panel"]').count(), 0);
console.log("sign-out: session gate restored");

// Tenant: can co-sign, cannot file.
await page.click('[data-testid="signin-minh"]');
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForTimeout(400);
assert.equal(await scope(), "openid tide.vault.read tide.claim.sign");
assert.equal(await page.locator('[data-testid="claim-submit"]').count(), 0);
assert.match(
  await page.locator('[data-testid="session-access"]').innerText(),
  /co-sign claims/,
);
console.log("tenant access: co-sign, claim form hidden");

// Switching rotates the session token.
const firstSub = await page
  .locator('[data-testid="session-token"]')
  .getAttribute("data-scope");
await page.click('[data-testid="persona-lan"]');
await page.waitForTimeout(600);
assert.equal(await scope(), "openid tide.vault.read tide.claim.sign");
assert.equal(await firstSub, "openid tide.vault.read tide.claim.sign");
const sub = await page.locator('[data-testid="session-panel"]').innerText();
assert.match(sub, /tenant/);
console.log("persona switch: token re-minted for Lan");

// Deep link auto sign-in for capture.
await page.goto("http://localhost:3000/?as=tuan", {
  waitUntil: "networkidle",
});
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForTimeout(400);
assert.equal(await scope(), "openid tide.vault.read tide.claim.sign");
console.log("deep link ?as=tuan: signed in automatically");

assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
console.log("auth check passed with no console errors");
await browser.close();
