import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// When copied into scripts/, root is project root.
const projectRoot = fs.existsSync(path.join(root, "package.json"))
  ? root
  : path.resolve(root, "..");

const playwrightEntry = path.join(
  projectRoot,
  "..",
  "테이블 디자이너",
  "프로그램",
  "node_modules",
  "playwright",
  "index.mjs",
);
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const outDir = path.join(projectRoot, "docs");
const boxOut = "C:/Users/Admin/AppData/Local/Temp/pattern-pr6-shots";
const workspaceOut = process.env.PR6_WORKSPACE_OUT || boxOut;
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(boxOut, { recursive: true });
fs.mkdirSync(workspaceOut, { recursive: true });

const server = await createServer({
  root: projectRoot,
  configFile: path.join(projectRoot, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4182, strictPort: true },
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
  const c = path.join(workspaceOut, name);
  await page.screenshot({ path: a, fullPage: false });
  fs.copyFileSync(a, b);
  try { fs.copyFileSync(a, c); } catch {}
  console.log("SHOT", name);
}

async function openGoalPlan() {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
  await page.goto("http://127.0.0.1:4182/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const sample = page.getByRole("button", { name: /예제|샘플/ });
  if (await sample.count()) {
    await sample.first().click();
    await page.waitForTimeout(700);
  }
  if (await page.getByText("경비·전투 예제").count()) {
    await page.getByText("경비·전투 예제").first().click();
    await page.waitForTimeout(500);
  }
  if (await page.getByText("경비 행동").count()) {
    await page.getByText("경비 행동").first().click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: "목표/계획" }).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="goal-plan-panel"]').waitFor({ state: "visible" });
}

try {
  await openGoalPlan();

  // 1) HasTarget=true → 3-step plan (default after demo click)
  await page.getByRole("button", { name: /HasTarget=true → 3단계/ }).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="plan-outcome"][data-outcome="plan_success"]').waitFor({ timeout: 5000 });
  await page.locator('[data-testid="plan-steps"]').waitFor({ state: "visible" });
  await shot("pr6-plan-success-3step.png");

  // 2) HasTarget=false → fail
  await page.getByRole("button", { name: /HasTarget=false → 실패/ }).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="plan-fail-reason"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-testid="plan-outcome"][data-outcome="unreachable"]').waitFor({ timeout: 5000 });
  await shot("pr6-plan-fail-HasTarget.png");

  // 3) Already achieved
  await page.getByRole("button", { name: /InAttackRange=true → 이미 달성/ }).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="plan-already-achieved"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-testid="plan-outcome"][data-outcome="already_achieved"]').waitFor({ timeout: 5000 });
  await shot("pr6-plan-already-achieved.png");

  // 4) Mid-exec invalidate → replan
  await page.getByRole("button", { name: /실행 중 무효화 → 재계획/ }).click();
  await page.waitForTimeout(500);
  await page.locator('[data-testid="plan-invalidated"]').waitFor({ state: "visible", timeout: 5000 });
  await page.locator('[data-testid="plan-replan-reason"]').waitFor({ state: "visible", timeout: 5000 });
  await shot("pr6-plan-invalidate-replan.png");

  // 5) Authoring view
  await page.getByRole("button", { name: /HasTarget=true → 3단계/ }).click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="goal-plan-authoring"]').scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "계획 행동", exact: true }).click();
  await page.waitForTimeout(400);
  await shot("pr6-goal-action-authoring.png");

  console.log("OK");
} catch (e) {
  await page.screenshot({ path: path.join(outDir, "pr6-semantic-fail.png"), fullPage: true }).catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
