import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightEntry = path.join(root, "..", "테이블 디자이너", "프로그램", "node_modules", "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4178, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const outDir = path.join(root, "docs");
try {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
  await page.goto("http://127.0.0.1:4178/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const sample = page.getByRole("button", { name: /예제|샘플/ });
  if (await sample.count()) {
    await sample.first().click();
    await page.waitForTimeout(900);
  }
  if (await page.getByText("경비·전투 예제").count()) {
    await page.getByText("경비·전투 예제").first().click();
    await page.waitForTimeout(700);
  }
  if (await page.getByText("경비 행동").count()) {
    await page.getByText("경비 행동").first().click();
    await page.waitForTimeout(700);
  }
  await page.locator(".graph-node.has-decision-brief, .graph-node.entity-decision").first().click({ force: true });
  await page.waitForTimeout(500);
  // If still not selected, click by node title inside canvas
  if (!(await page.locator(".decision-candidate-card").count())) {
    await page.locator(".react-flow__node").filter({ hasText: "행동 판단" }).first().click({ force: true });
    await page.waitForTimeout(600);
  }
  await page.locator(".decision-candidate-card").first().waitFor({ state: "visible", timeout: 15000 });
  await page.getByText("하드 조건 (미충족 시 제외)").first().waitFor({ state: "visible", timeout: 5000 });
  await page.getByText("고려 요인 (점수 영향)").first().waitFor({ state: "visible", timeout: 5000 });

  const full = path.join(outDir, "pr4-decision-inspector.png");
  await page.screenshot({ path: full, fullPage: false });
  const panel = path.join(outDir, "pr4-decision-inspector-panel.png");
  await page.locator(".pattern-inspector").screenshot({ path: panel });
  console.log("OK", full, panel);
} catch (error) {
  const fail = path.join(outDir, "pr4-decision-fail2.png");
  await page.screenshot({ path: fail, fullPage: true }).catch(() => {});
  console.error("FAIL", error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
