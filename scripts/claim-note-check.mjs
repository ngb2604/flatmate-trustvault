import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});

await page.goto("http://localhost:3000/?as=bay", { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
await page.waitForSelector('[data-testid="settlement-panel"]', {
  timeout: 20000,
});

// Normalise a previous run to a clean vault where the landlord can file.
if ((await page.locator('[data-testid="claim-submit"]').count()) === 0) {
  await page.click('[data-testid="reset-demo"]');
  await page.waitForSelector('[data-testid="claim-submit"]', {
    timeout: 20000,
  });
}

// Open the confidential-note drawer and confirm the demo text is present.
await page.locator("summary", { hasText: "Confidential evidence note" }).click();
const noteField = page.locator('[data-testid="claim-note"]');
await noteField.waitFor({ state: "visible", timeout: 5000 });
const note = await noteField.inputValue();
assert.match(note, /Plumber invoice #F-2041/);
assert.match(
  await page.locator('[data-testid="settlement-panel"]').innerText(),
  /AES-256-GCM/,
);

await page.click('[data-testid="claim-submit"]');
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="settlement-panel"]')
      ?.textContent?.includes("Tenant consensus"),
  { timeout: 20000 },
);

// The server-view inspector must expose only the ciphertext envelope.
await page.waitForFunction(
  () => {
    const panel = document.querySelector('[data-testid="data-panel"]');
    return panel?.textContent?.includes("ENC_TIDE_v1:");
  },
  { timeout: 20000 },
);
const inspector = await page
  .locator('[data-testid="data-panel"]')
  .innerText();
assert.doesNotMatch(inspector, /Plumber invoice #F-2041/);
assert.match(inspector, /claim\.confidentialNote/);
assert.match(inspector, /ENC_TIDE_v1:/);
console.log("claim note: inspector shows ciphertext only");

const ledger = JSON.parse(await fs.readFile("data/vault-db.json", "utf8"));
assert.ok(ledger.claim?.confidentialNote?.ciphertext, "note must be stored");
assert.equal(ledger.claim.confidentialNote.alg, "AES-GCM-256");
assert.ok(!JSON.stringify(ledger).includes("Plumber invoice #F-2041"));
console.log("claim note: ciphertext on disk, plaintext absent");

await page.click('[data-testid="reset-demo"]');
await page.waitForSelector('[data-testid="claim-submit"]', {
  timeout: 20000,
});
await browser.close();
console.log("\nConfidential claim-note check passed");
