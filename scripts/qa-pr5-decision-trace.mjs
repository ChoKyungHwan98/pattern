import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightEntry = path.join(root, "..", "테이블 디자이너", "프로그램", "node_modules", "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4179, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });

async function openGuardSample() {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
  await page.goto("http://127.0.0.1:4179/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const sample = page.getByRole("button", { name: /예제|샘플/ });
  if (await sample.count()) {
    await sample.first().click();
    await page.waitForTimeout(800);
  }
  if (await page.getByText("경비·전투 예제").count()) {
    await page.getByText("경비·전투 예제").first().click();
    await page.waitForTimeout(700);
  }
  if (await page.getByText("경비 행동").count()) {
    await page.getByText("경비 행동").first().click();
    await page.waitForTimeout(700);
  }
}

try {
  await openGuardSample();

  // 1) Context test value edit
  await page.getByRole("button", { name: "문맥/변수" }).click();
  await page.waitForTimeout(400);
  const live = page.locator('input[aria-label="현재값"]').first();
  await live.waitFor({ state: "visible", timeout: 10000 });
  await live.click({ clickCount: 3 });
  await live.fill("3.5");
  await page.waitForTimeout(300);
  const shot1 = path.join(outDir, "pr5-context-test-values.png");
  await page.screenshot({ path: shot1, fullPage: false });

  // Select Decision node
  await page.locator(".react-flow__node").filter({ hasText: "행동 판단" }).first().click({ force: true });
  await page.waitForTimeout(500);

  // 2) Candidate score comparison via Decision Trace tab
  await page.getByRole("button", { name: "Decision Trace" }).click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid="decision-trace-panel"]').waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".decision-trace-score-row").first().waitFor({ state: "visible", timeout: 5000 });
  const shot2 = path.join(outDir, "pr5-candidate-score-compare.png");
  await page.screenshot({ path: shot2, fullPage: false });

  // 3) Selected candidate Decision Trace detail
  const rows = page.locator(".decision-trace-score-row");
  const count = await rows.count();
  // Prefer selected / non-excluded
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const cls = (await row.getAttribute("class")) || "";
    if (cls.includes("is-selected") || !cls.includes("is-excluded")) {
      await row.click();
      clicked = true;
      break;
    }
  }
  if (!clicked && count > 0) await rows.first().click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="decision-trace-detail"]').waitFor({ state: "visible", timeout: 5000 });
  const shot3 = path.join(outDir, "pr5-selected-decision-trace.png");
  await page.screenshot({ path: shot3, fullPage: false });

  console.log("OK", shot1, shot2, shot3);
} catch (error) {
  const fail = path.join(outDir, "pr5-fail.png");
  await page.screenshot({ path: fail, fullPage: true }).catch(() => {});
  console.error("FAIL", error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
