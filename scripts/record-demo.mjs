import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { chromium } from "playwright-core";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RAW_DIR = "artifacts/video";
const OUT = "demo.mp4";

rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: RAW_DIR, size: { width: 1440, height: 900 } },
});

// Title, caption and end-card chrome live above React's root and never re-render.
await context.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = `
    #__caption {
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
      z-index: 99998; max-width: 880px; padding: 12px 20px 13px;
      border-radius: 12px; background: rgba(4, 8, 14, .94);
      border: 1px solid rgba(52, 211, 153, .32);
      box-shadow: 0 18px 60px rgba(0, 0, 0, .55);
      color: #e6fff5; font: 500 16px/1.45 Inter, ui-sans-serif, sans-serif;
      letter-spacing: .005em; text-align: center; opacity: 0;
      transition: opacity .28s ease; pointer-events: none;
    }
    #__caption b { color: #6ee7b7; font-weight: 600; }
    #__caption .step {
      display: block; margin-bottom: 3px; color: #34d399;
      font: 600 10px/1.4 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: .16em; text-transform: uppercase;
    }
    #__title, #__end {
      position: fixed; inset: 0; z-index: 99999; display: grid; place-items: center;
      background:
        radial-gradient(800px 500px at 50% 42%, rgba(16, 185, 129, .13), transparent 65%),
        #05070b;
      color: #e6fff5; text-align: center; padding: 48px;
      transition: opacity .45s ease;
    }
    #__title .mark, #__end .mark {
      width: 54px; height: 54px; margin: 0 auto 22px; border-radius: 15px;
      display: grid; place-items: center; border: 1px solid rgba(52, 211, 153, .45);
      background: rgba(52, 211, 153, .1); color: #6ee7b7;
    }
    #__title .kicker, #__end .kicker {
      color: #34d399; font: 600 11px/1.4 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: .22em; text-transform: uppercase; margin-bottom: 18px;
    }
    #__title h1, #__end h1 {
      margin: 0; font: 600 58px/1.04 Inter, ui-sans-serif, sans-serif;
      letter-spacing: -.035em;
    }
    #__title h1 span, #__end h1 span { color: #6ee7b7; }
    #__title p, #__end p {
      margin: 18px auto 0; max-width: 660px; color: #9fb3c8;
      font: 400 18px/1.55 Inter, ui-sans-serif, sans-serif;
    }
    #__title .meta, #__end .meta {
      margin-top: 30px; color: #64748b;
      font: 500 12px/1.5 "JetBrains Mono", ui-monospace, monospace;
      letter-spacing: .06em;
    }
    #__end .grid {
      display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
      margin-top: 26px; color: #c7d5e4; font-size: 13px;
    }
    #__end .grid span {
      padding: 7px 11px; border-radius: 8px; border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.03);
    }
    .__hidden { opacity: 0 !important; }
  `;
  const boot = () => {
    document.head.appendChild(style);
    const caption = document.createElement("div");
    caption.id = "__caption";
    document.body.appendChild(caption);
    const title = document.createElement("div");
    title.id = "__title";
    title.innerHTML = `
      <div>
        <div class="mark">${shieldSvg()}</div>
        <div class="kicker">TideCloak Challenge 2 · 2026</div>
        <h1>A $1,200 bond.<br/><span>No master key.</span></h1>
        <p>Four identities. One written policy. Two of three tenants plus the landlord — never one person alone.</p>
        <div class="meta">FLATMATE TRUSTVAULT · SERVER-VERIFIED RBAC</div>
      </div>`;
    document.body.appendChild(title);
  };
  function shieldSvg() {
    return `<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`;
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
});

const page = await context.newPage();
page.on("pageerror", (error) => console.log("pageerror:", error.message));

const started = Date.now();
const hold = (ms) => page.waitForTimeout(ms);

async function caption(step, text) {
  await page.evaluate(
    ({ step, text }) => {
      const el = document.getElementById("__caption");
      if (!el) return;
      el.innerHTML = `<span class="step">${step}</span>${text}`;
      el.style.opacity = "1";
    },
    { step, text },
  );
}

async function hideCaption() {
  await page.evaluate(() => {
    const el = document.getElementById("__caption");
    if (el) el.style.opacity = "0";
  });
}

async function removeTitle() {
  await page.evaluate(() => {
    const el = document.getElementById("__title");
    if (!el) return;
    el.classList.add("__hidden");
    setTimeout(() => el.remove(), 500);
  });
  await hold(520);
}

async function endCard() {
  await hideCaption();
  await page.evaluate(() => {
    const el = document.createElement("div");
    el.id = "__end";
    el.innerHTML = `
      <div>
        <div class="mark"><svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></div>
        <div class="kicker">Flatmate TrustVault</div>
        <h1>A bond that <span>cannot move alone.</span></h1>
        <p>Server-verified roles. Browser-held approvals. Ciphertext-only records.<br/>Every blocked attempt leaves a signed receipt.</p>
        <div class="grid"><span>1 landlord + 2/3 tenants</span><span>ES256 · ECDSA P-256</span><span>AES-256-GCM</span></div>
        <div class="meta">TIDECLOAK CHALLENGE 2 · RMIT GENAI &amp; CYBERSECURITY HACKATHON 2026</div>
      </div>`;
    document.body.appendChild(el);
  });
}

async function scrollTop() {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await hold(900);
}

async function smoothTo(selector, block = "center") {
  await page.evaluate(
    ({ selector, block }) => {
      document
        .querySelector(selector)
        ?.scrollIntoView({ behavior: "smooth", block });
    },
    { selector, block },
  );
  await hold(900);
}

async function expectText(selector, text) {
  await page.waitForFunction(
    ({ selector, text }) =>
      document.querySelector(selector)?.textContent?.includes(text),
    { selector, text },
    { timeout: 30000 },
  );
}

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="signin-minh"]', { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await hold(2900);

  await removeTitle();
  await hold(900);
  await page.click('[data-testid="signin-minh"]');
  await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 20000 });
  await page.waitForSelector('[data-testid="settlement-panel"]', {
    timeout: 20000,
  });
  await hold(700);

  await caption(
    "01 · Identity",
    "Server-issued ES256 sessions. Every API call is verified, never trusted.",
  );
  await hold(2800);

  await page.click('[data-testid="jwt-button"]');
  await page.waitForSelector('[data-testid="jwt-modal"]', { timeout: 10000 });
  await caption(
    "02 · Raw session",
    "Issuer, audience, realm roles and the browser-bound approval key — inspectable.",
  );
  await hold(3900);
  await page.click(
    '[data-testid="jwt-modal"] button[aria-label="Close JWT inspector"]',
  );
  await hold(600);

  await smoothTo('[data-testid="attack-panel"]');
  await caption(
    "03 · Lead tenant",
    "The lead tenant tries to withdraw the entire <b>$1,200</b> bond.",
  );
  await hold(1600);
  await page.click('[data-testid="attack-minh"]');
  await expectText(
    '[data-testid="attack-panel"]',
    "TIDECLOAK_EMERGENT_AUTHORITY_MISSING",
  );
  await caption(
    "03 · Blocked",
    "<b>403 TIDECLOAK_EMERGENT_AUTHORITY_MISSING.</b> No funds moved. Signed proof is in the audit chain.",
  );
  await hold(3600);

  await scrollTop();
  await page.click('[data-testid="persona-bay"]');
  await page.waitForSelector('[data-testid="claim-submit"]', { timeout: 15000 });
  await smoothTo('[data-testid="attack-panel"]');
  await caption(
    "04 · Landlord",
    "The landlord tries a <b>$300</b> force-deduct without tenant consent.",
  );
  await hold(1600);
  await page.click('[data-testid="attack-bay"]');
  await expectText('[data-testid="attack-panel"]', "MISSING_CONSENSUS");
  await caption(
    "04 · Blocked",
    "<b>403 MISSING_CONSENSUS.</b> Custody is proposal-only. One signature cannot release funds.",
  );
  await hold(3500);

  await smoothTo('[data-testid="settlement-panel"]', "start");
  await caption(
    "05 · Claim",
    "The landlord files a <b>$150</b> faucet claim, backed by photo evidence.",
  );
  await hold(1500);
  await page
    .locator("summary", { hasText: "Confidential evidence note" })
    .click();
  await hold(600);
  await caption(
    "05 · Confidential note",
    "The note is encrypted with <b>AES-256-GCM</b> before it leaves the browser.",
  );
  await hold(2200);
  await page.click('[data-testid="claim-submit"]');
  await page.waitForSelector('[data-testid="sig-row-minh"]', { timeout: 20000 });
  await hold(800);

  await smoothTo('[data-testid="data-panel"]', "start");
  await page
    .getByText("claim.confidentialNote", { exact: true })
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await caption(
    "05 · Server view",
    "The database inspector sees only <b>ENC_TIDE_v1:</b> ciphertext. The plaintext never arrived.",
  );
  await hold(3600);

  await scrollTop();
  await page.click('[data-testid="persona-minh"]');
  await page.waitForSelector('[data-testid="sign-minh"]', { timeout: 15000 });
  await smoothTo('[data-testid="settlement-panel"]', "start");
  await caption("06 · First signature", "One tenant signs. The vault stays locked.");
  await hold(1400);
  await page.click('[data-testid="sign-minh"]');
  await page.waitForSelector('[data-testid="sign-minh"]', {
    state: "detached",
    timeout: 20000,
  });
  await caption(
    "06 · 1 of 2",
    "Consensus is <b>1 of 2</b>. Signatures are ECDSA P-256, verified server-side.",
  );
  await hold(2800);

  await scrollTop();
  await page.click('[data-testid="persona-lan"]');
  await page.waitForSelector('[data-testid="sign-lan"]', { timeout: 15000 });
  await smoothTo('[data-testid="settlement-panel"]', "start");
  await caption(
    "07 · Authority",
    "A second tenant signs. <b>Emergent authority unlocks</b> for one atomic release.",
  );
  await hold(1400);
  await page.click('[data-testid="sign-lan"]');
  await page.waitForSelector('[data-testid="authority-banner"]', {
    timeout: 20000,
  });
  await hold(1400);
  await smoothTo('[data-testid="vault-panel"]', "center");
  await caption(
    "07 · Settled",
    "Atomic settlement: <b>$350</b> back to each tenant and <b>$150</b> compensation to the landlord.",
  );
  await hold(4200);

  await page.click('[data-testid="reset-demo"]');
  await page.waitForSelector('[data-testid="claim-dispute"]', { timeout: 15000 });
  await smoothTo('[data-testid="settlement-panel"]', "center");
  await caption(
    "08 · Dispute",
    "Reset. Two tenants reject the claim. Only the disputed <b>$150</b> may freeze.",
  );
  await hold(1600);
  await page.click('[data-testid="claim-dispute"]');
  await page.waitForSelector('[data-testid="dispute-banner"]', {
    timeout: 30000,
  });
  await hold(800);
  await smoothTo('[data-testid="vault-panel"]', "center");
  await caption(
    "08 · Partial freeze",
    "<b>$1,050</b> is refunded now. <b>$150</b> stays frozen for neutral arbitration.",
  );
  await hold(4200);

  await scrollTop();
  await page.click('[data-testid="persona-minh"]');
  await page.waitForSelector('[data-testid="vault-panel"]', { timeout: 15000 });
  await smoothTo('[data-testid="data-panel"]', "start");
  await caption(
    "09 · Field encryption",
    "Refund IBAN, account name and student ID are encrypted in this tab.",
  );
  await hold(1700);
  await page.click('[data-testid="pii-save"]');
  await expectText('[data-testid="data-panel"]', "stored as ciphertext");
  await expectText('[data-testid="data-panel"]', "ENC_TIDE_v1:");
  await hold(700);
  await page.click('[data-testid="pii-reveal"]');
  await expectText('[data-testid="data-panel"]', "Decrypted locally");
  await caption(
    "09 · Ciphertext only",
    "The server stores ciphertext. Only the owner's browser key can reveal it.",
  );
  await hold(3800);

  await endCard();
  await hold(4300);
} finally {
  await context.close();
  await browser.close();
}

const raw = await page.video().path();
const elapsed = ((Date.now() - started) / 1000).toFixed(1);
console.log(`recorded ${raw} (${elapsed}s)`);

execFileSync(
  ffmpeg.path,
  [
    "-y",
    "-i",
    raw,
    "-vf",
    "scale=1440:900:flags=lanczos,fps=30",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    OUT,
  ],
  { stdio: "inherit" },
);

const bytes = statSync(OUT).size;
const probe = spawnSync(ffmpeg.path, ["-i", OUT], { encoding: "utf8" });
const duration = probe.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
console.log(
  `wrote ${OUT}: ${(bytes / 1024 / 1024).toFixed(2)} MB, duration ${
    duration ? `${duration[1]}:${duration[2]}:${duration[3]}` : "unknown"
  }`,
);
if (!existsSync(OUT)) process.exit(1);
