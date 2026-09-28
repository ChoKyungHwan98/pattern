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
  server: { host: "127.0.0.1", port: 4181, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

async function shot(name) {
  const a = path.join(outDir, name);
  const b = path.join(boxOut, name);
  await page.screenshot({ path: a, fullPage: false });
  fs.copyFileSync(a, b);
  console.log("SHOT", name);
}

try {
  await page.addInitScript(() => { try { window.localStorage.clear(); } catch {} });
  await page.goto("http://127.0.0.1:4181/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const sample = page.getByRole("button", { name: /예제|샘플/ });
  if (await sample.count()) { await sample.first().click(); await page.waitForTimeout(700); }
  if (await page.getByText("경비·전투 예제").count()) { await page.getByText("경비·전투 예제").first().click(); await page.waitForTimeout(500); }
  if (await page.getByText("경비 행동").count()) { await page.getByText("경비 행동").first().click(); await page.waitForTimeout(600); }

  await page.getByRole("button", { name: "목표/계획" }).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="goal-plan-panel"]').waitFor({ state: "visible" });
  // Expand drawer by scrolling plan into view
  await page.locator(".goal-plan-steps, .goal-plan-card.wide").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(300);
  await shot("pr6-goal-plan-ui.png");

  // Fail: toggle HasTarget false
  const btn = page.locator(".goal-plan-facts.editable button.is-true").first();
  await btn.click();
  await page.waitForTimeout(400);
  await page.locator('[data-testid="plan-fail-reason"]').waitFor({ state: "visible", timeout: 5000 });
  await shot("pr6-plan-fail-reason.png");

  console.log("OK");
} catch (e) {
  await page.screenshot({ path: path.join(outDir, "pr6-rescapture-fail.png"), fullPage: true }).catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
