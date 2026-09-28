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
  server: { host: "127.0.0.1", port: 4191, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const outDir = path.join(root, "docs");
const boxMirror = path.join(root, ".pr7-screenshots");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(boxMirror, { recursive: true });

async function clickNode(text) {
  const node = page.locator(".react-flow__node").filter({ hasText: text }).first();
  await node.waitFor({ state: "visible", timeout: 10000 });
  await node.click({ force: true });
  await page.waitForTimeout(400);
}

async function shot(name) {
  const file = `${name}.png`;
  const a = path.join(outDir, file);
  const b = path.join(boxMirror, file);
  await page.screenshot({ path: a, fullPage: false });
  fs.copyFileSync(a, b);
  console.log("shot", file);
}

try {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
  await page.goto("http://127.0.0.1:4191/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // E) New Behavior first screen (no algorithm picker)
  await page.getByRole("button", { name: /새 패턴 세트/ }).first().click();
  await page.getByPlaceholder("예: 보스 1페이즈 전투 AI").fill("PR7 언어 정리");
  await page.locator(".home-modal").getByRole("button", { name: "만들기", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /새 패턴/ }).first().click();
  const dialog = page.getByRole("dialog", { name: /새 행동 패턴 만들기/ });
  await dialog.waitFor({ state: "visible" });
  const dialogText = await dialog.innerText();
  for (const bad of ["FSM", "HFSM", "Utility", "GOAP", "Behavior Tree", "유틸리티", "알고리즘"]) {
    if (dialogText.includes(bad)) console.error("CREATE_JARGON", bad);
  }
  await shot("pr7-e-new-behavior");
  await dialog.getByRole("button", { name: "취소", exact: true }).click();
  await page.waitForTimeout(300);

  const homeBtn = page.getByRole("button", { name: /세트 목록/ });
  if (await homeBtn.count()) {
    await homeBtn.first().click();
    await page.waitForTimeout(400);
  }
  await page.getByRole("button", { name: /경비·전투 예제 불러오기|예제 불러오기/ }).first().click();
  await page.waitForTimeout(900);
  const guard = page.getByRole("button", { name: /경비 행동/ });
  if (await guard.count()) {
    await guard.first().click();
    await page.waitForTimeout(500);
  }

  // A) Guard Behavior Canvas
  await clickNode("순찰");
  await page.getByRole("button", { name: /^시뮬레이션/ }).click();
  await page.waitForTimeout(400);
  await shot("pr7-a-guard-canvas");

  // B) Decision + Inspector
  await clickNode("행동 판단");
  await page.waitForTimeout(500);
  await page.getByText("고려 요인 비교").first().waitFor({ state: "visible", timeout: 8000 });
  const bodyB = await page.locator("body").innerText();
  if (bodyB.includes("유틸리티")) console.error("JARGON_LEAK Utility label still visible");
  await shot("pr7-b-decision-inspector");

  // C) Decision simulation
  await page.getByRole("button", { name: /^시뮬레이션/ }).click();
  const decideTab = page.getByRole("tab", { name: "판단", exact: true });
  if (await decideTab.count()) await decideTab.click();
  await page.waitForTimeout(500);
  await shot("pr7-c-decision-simulation");

  // D) Goal needed (far-range → approach plan)
  await page.getByRole("button", { name: /^시뮬레이션/ }).click();
  await page.waitForTimeout(300);
  const goalTab = page.locator('[role="tablist"][aria-label="시뮬레이션 보기"]').getByRole("tab", { name: /목표/ });
  await goalTab.waitFor({ state: "visible", timeout: 8000 });
  await goalTab.click();
  await page.waitForTimeout(500);
  await page.getByText("현재 상황/문맥").first().waitFor({ state: "visible", timeout: 8000 });
  await page.getByText("실행 계획").first().waitFor({ state: "visible", timeout: 5000 });
  const bodyD = await page.locator("body").innerText();
  for (const good of ["대상 발견됨", "공격 범위 안", "접근 중", "대시 완료"]) {
    if (!bodyD.includes(good)) console.warn("MISSING_DISPLAY", good);
  }
  for (const bad of ["GOAP", "Goal State", "Preconditions", "World State", "유틸리티"]) {
    if (bodyD.includes(bad)) console.error("JARGON_LEAK", bad);
  }
  await shot("pr7-d-goal-simulation");

  console.log("OK PR7 screenshots");
} finally {
  await browser.close();
  await server.close();
}
