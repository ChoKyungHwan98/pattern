import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightEntry = path.join(
  root,
  "..",
  "테이블 디자이너",
  "프로그램",
  "node_modules",
  "playwright",
  "index.mjs",
);
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  server: { host: "127.0.0.1", port: 4188, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const outDir = path.join(root, "docs");
fs.mkdirSync(outDir, { recursive: true });

async function clickNode(text) {
  const node = page.locator(".react-flow__node").filter({ hasText: text }).first();
  await node.waitFor({ state: "visible", timeout: 10000 });
  await node.click({ force: true });
  await page.waitForTimeout(350);
}

try {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
  await page.goto("http://127.0.0.1:4188/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  const sampleCta = page.getByRole("button", { name: /경비·전투 예제 불러오기|예제 불러오기/ });
  await sampleCta.first().click();
  await page.waitForTimeout(900);

  const guard = page.getByRole("button", { name: /경비 행동/ });
  if (await guard.count()) {
    await guard.first().click();
    await page.waitForTimeout(500);
  }

  for (const label of ["문맥", "시뮬레이션", "검증", "리뷰"]) {
    await page.getByRole("button", { name: new RegExp(`^${label}`) }).first().waitFor({ state: "visible", timeout: 8000 });
  }

  // 1) patrol
  await clickNode("순찰");
  await page.getByRole("button", { name: /^시뮬레이션/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "pr-consol-guard-patrol.png"), fullPage: false });

  // 2) alert after spot
  await clickNode("경계");
  await page.screenshot({ path: path.join(outDir, "pr-consol-guard-alert.png"), fullPage: false });

  // 3) decide response
  await clickNode("행동 판단");
  const decideTab = page.getByRole("tab", { name: "판단", exact: true });
  if (await decideTab.count()) await decideTab.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, "pr-consol-guard-decision.png"), fullPage: false });

  // 4) pick attack — match node titled 공격 (entity-action)
  const attackNode = page.locator(".react-flow__node.entity-action, .react-flow__node").filter({ hasText: "공격" }).first();
  await attackNode.click({ force: true });
  await page.waitForTimeout(400);
  const actionTab = page.getByRole("tab", { name: "행동", exact: true });
  if (await actionTab.count()) await actionTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "pr-consol-guard-attack.png"), fullPage: false });

  // 5) too far → approach goal
  await page.getByRole("tab", { name: "목표·계획", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByText("현재 상황/문맥").first().waitFor({ state: "visible", timeout: 8000 });
  await page.getByText("실행 계획").first().waitFor({ state: "visible", timeout: 5000 });
  const bodyText = await page.locator("body").innerText();
  const leaks = ["GOAP", "Goal State", "Preconditions", "(World)", "Plan Trace"].filter((bad) => bodyText.includes(bad));
  if (leaks.length) console.error("JARGON_LEAK", leaks.join(", "));
  else console.log("no jargon leaks");
  await page.screenshot({ path: path.join(outDir, "pr-consol-guard-approach-goal.png"), fullPage: false });

  // overview with 4 tabs visible
  await page.screenshot({ path: path.join(outDir, "pr-consol-four-tabs-overview.png"), fullPage: false });
  console.log("OK screenshots in", outDir);
} finally {
  await browser.close();
  await server.close();
}
