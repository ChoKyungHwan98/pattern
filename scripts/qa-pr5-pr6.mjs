import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightEntry = path.join(root, "..", "테이블 디자이너", "프로그램", "node_modules", "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const outDir = path.join(root, "docs");
const boxOut = "C:/Users/Admin/AppData/Local/Temp/pattern-pr5-pr6-shots";
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(boxOut, { recursive: true });

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4180, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });

async function shot(name) {
  const a = path.join(outDir, name);
  const b = path.join(boxOut, name);
  await page.screenshot({ path: a, fullPage: false });
  fs.copyFileSync(a, b);
  console.log("SHOT", name);
}

async function openGuardSample() {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
  await page.goto("http://127.0.0.1:4180/", { waitUntil: "networkidle" });
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

  // PR5: validation should be clean (no false ambiguous-always)
  await shot("pr5-validation-clean.png");

  // Select Decision, open Decision Trace
  await page.locator(".react-flow__node").filter({ hasText: "행동 판단" }).first().click({ force: true });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Decision Trace" }).click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid="decision-trace-panel"]').waitFor({ state: "visible", timeout: 10000 });

  // Click an excluded or non-selected candidate if possible
  const rows = page.locator(".decision-trace-score-row");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const cls = (await row.getAttribute("class")) || "";
    if (cls.includes("is-excluded") || cls.includes("status-zero") || cls.includes("status-eligible")) {
      await row.click();
      break;
    }
  }
  await page.waitForTimeout(400);
  await shot("pr5-candidate-clickable-trace.png");

  // Start sim to emphasize selected edge
  const play = page.getByRole("button", { name: /실행/ }).first();
  if (await play.count()) {
    await play.click();
    await page.waitForTimeout(700);
  }
  await shot("pr5-sim-edge-emphasis.png");

  // Stop sim
  const stop = page.getByRole("button", { name: /실행 중지/ }).first();
  if (await stop.count()) await stop.click();
  await page.waitForTimeout(300);

  // PR6 Goal / Plan
  await page.getByRole("button", { name: "목표/계획" }).click();
  await page.waitForTimeout(600);
  await page.locator('[data-testid="goal-plan-panel"]').waitFor({ state: "visible", timeout: 10000 });
  await shot("pr6-goal-plan-ui.png");

  // Fail path: flip HasTarget
  const hasTargetBtn = page.locator('.goal-plan-facts.editable button').filter({ hasText: "true" }).first();
  if (await hasTargetBtn.count()) {
    await hasTargetBtn.click();
    await page.waitForTimeout(400);
  }
  await shot("pr6-plan-fail-reason.png");

  console.log("OK boxOut=", boxOut);
} catch (error) {
  const fail = path.join(outDir, "pr5-pr6-fail.png");
  await page.screenshot({ path: fail, fullPage: true }).catch(() => {});
  console.error("FAIL", error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
