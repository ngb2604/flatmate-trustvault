import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (error) => console.log("pageerror:", error.message));

await page.goto("http://localhost:3000/?as=minh", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="data-panel"]', { timeout: 20000 });
await page.waitForTimeout(400);

// Owner encrypts the demo bank/ID fields.
await page.click('[data-testid="pii-save"]');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="data-panel"]')
      ?.textContent?.includes("Encrypted in this tab"),
  { timeout: 20000 },
);
await page.waitForTimeout(800);

const panelText = await page.locator('[data-testid="data-panel"]').innerText();
assert.match(panelText, /ENC_TIDE_v1:/);
assert.match(panelText, /Refund IBAN/);
assert.doesNotMatch(panelText, /VN98-TECHCOMBANK-1903848291/);
console.log("inspector: ciphertext envelope shown, plaintext IBAN absent");

// The ledger on disk must contain ciphertext only.
await page.waitForTimeout(400);
const ledger = await fs.readFile("data/vault-db.json", "utf8");
assert.ok(ledger.includes('"ciphertext"'), "ledger should contain ciphertext");
assert.ok(!ledger.includes("VN98-TECHCOMBANK-1903848291"), "no plaintext IBAN");
assert.ok(!ledger.includes("STU-2026-1107"), "no plaintext national id");
console.log("ledger: no plaintext bank details or national ID");

// Owner can decrypt in the same browser tab.
await page.click('[data-testid="pii-reveal"]');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="data-panel"]')
      ?.textContent?.includes("Decrypted locally"),
  { timeout: 10000 },
);
const revealed = await page.locator('[data-testid="data-panel"]').innerText();
assert.match(revealed, /VN98-TECHCOMBANK-1903848291/);
console.log("owner reveal: plaintext decrypted client-side");

await page.screenshot({
  path: "artifacts/data-protection.png",
  fullPage: true,
});

// A different identity cannot decrypt the owner's record in its tab.
await page.click('[data-testid="persona-lan"]');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="data-panel"]')
      ?.textContent?.includes("No protected record yet for Lan"),
  { timeout: 20000 },
);
await page.waitForTimeout(400);
const lanPanel = await page.locator('[data-testid="data-panel"]').innerText();
assert.doesNotMatch(lanPanel, /VN98-TECHCOMBANK-1903848291/);
assert.match(lanPanel, /No protected record yet/);
await page.screenshot({
  path: "artifacts/data-protection-other-user.png",
  fullPage: true,
});
console.log("role isolation: Lan sees no Minh plaintext");

await browser.close();
console.log("\nPII encryption check passed");
