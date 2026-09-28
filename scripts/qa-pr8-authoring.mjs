/**
 * PR8 — capture A–F while authoring 상점 NPC from EMPTY Behavior through the real UI.
 * Does NOT open a pre-baked shop fixture.
 */
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
  server: { host: "127.0.0.1", port: 4192, strictPort: true },
});
await server.listen();

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const outDir = path.join(root, "docs");
const localMirror = path.join(root, ".pr8-screenshots");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(localMirror, { recursive: true });

async function shot(name) {
  const file = `${name}.png`;
  const a = path.join(outDir, file);
  const b = path.join(localMirror, file);
  await page.screenshot({ path: a, fullPage: false });
  fs.copyFileSync(a, b);
  console.log("shot", file);
}

async function renameSelected(name) {
  const input = page.locator("[data-node-name-input]");
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.fill(name);
  await input.blur();
  await page.waitForTimeout(250);
}

async function addPalette(label) {
  await page.getByRole("button", { name: "행동 요소 추가" }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await page.waitForTimeout(300);
}

async function createInlineContext(displayName) {
  await page.getByTestId("create-context-inline").click();
  await page.getByLabel("문맥 표시 이름").fill(displayName);
  await page.getByTestId("confirm-new-context").click();
  await page.waitForTimeout(400);
}

try {
  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch {}
  });
  await page.goto("http://127.0.0.1:4192/", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // Fresh set + empty Behavior (no algorithm picker)
  await page.getByRole("button", { name: /새 패턴 세트/ }).first().click();
  await page.getByPlaceholder("예: 보스 1페이즈 전투 AI").fill("PR8 상점 저작");
  await page.locator(".home-modal, .pattern-modal, body").getByRole("button", { name: "만들기", exact: true }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /새 패턴/ }).first().click();
  const dialog = page.getByRole("dialog", { name: /새 행동 패턴 만들기/ });
  await dialog.waitFor({ state: "visible" });
  await dialog.getByPlaceholder("새 행동 패턴").fill("상점 NPC");
  await dialog.getByRole("button", { name: "패턴 만들기", exact: true }).click();
  await page.waitForTimeout(600);

  // A) right after create — empty CTA
  await page.getByTestId("first-situation-cta").waitFor({ state: "visible", timeout: 8000 });
  await shot("pr8-a-after-create");

  // B) first situation
  await page.getByTestId("first-situation-cta").click();
  await page.waitForTimeout(500);
  await renameSelected("대기");
  await shot("pr8-b-first-situation");

  // More situations
  await addPalette("상황");
  await renameSelected("인사");
  await addPalette("상황");
  await renameSelected("도망");

  // C) connect 대기 → 인사 + condition
  await page.getByText("대기", { exact: true }).first().click();
  await page.waitForTimeout(200);
  const quick = page.getByTestId("quick-connect");
  const greetValue = await quick.locator("option").evaluateAll((opts) => {
    const hit = opts.find((o) => (o.textContent || "").startsWith("인사"));
    return hit ? hit.value : "";
  });
  if (!greetValue) throw new Error("인사 option missing");
  await quick.selectOption(greetValue);
  await page.getByText("언제 이 흐름을 타는가?").first().waitFor({ state: "visible", timeout: 8000 });
  await createInlineContext("가까움");
  await shot("pr8-c-connect-condition");

  // Return path 인사 → 대기
  await page.getByText("인사", { exact: true }).first().click();
  await page.waitForTimeout(200);
  {
    const qc = page.getByTestId("quick-connect");
    const waitValue = await qc.locator("option").evaluateAll((opts) => {
      const hit = opts.find((o) => (o.textContent || "").startsWith("대기"));
      return hit ? hit.value : "";
    });
    if (!waitValue) throw new Error("대기 option missing");
    await qc.selectOption(waitValue);
  }
  await page.waitForTimeout(300);
  const ctxSelect = page.getByLabel("문맥 값").first();
  if (await ctxSelect.count()) {
    await ctxSelect.selectOption("가까움").catch(() => {});
  }

  // D) add action + decision
  await addPalette("행동");
  await renameSelected("인사하기");
  await addPalette("판단");
  await renameSelected("응대 판단");
  await shot("pr8-d-action-decision");

  // E) anywhere interrupt → flee
  await page.getByText("도망", { exact: true }).first().click();
  await page.getByTestId("anywhere-interrupt-button").click();
  await page.getByText("언제 이 흐름을 타는가?").first().waitFor({ state: "visible" });
  await createInlineContext("공격받음");
  await shot("pr8-e-anywhere-interrupt");

  // F) simulation with context toggle
  await page.getByRole("button", { name: /^문맥/ }).click();
  await page.waitForTimeout(300);
  // set 가까움 true
  const nearRow = page.locator(".blackboard-table tr").filter({ hasText: "가까움" }).first();
  if (await nearRow.count()) {
    await nearRow.getByLabel("현재값").fill("true");
  }
  await page.getByRole("button", { name: /^시뮬레이션/ }).click();
  await page.waitForTimeout(400);
  // try play
  const play = page.getByRole("button", { name: /재생|시작|플레이/ }).first();
  if (await play.count()) {
    await play.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  await shot("pr8-f-simulation");

  console.log("PR8 authoring shots complete");
} catch (error) {
  console.error("PR8_QA_FAIL", error);
  await shot("pr8-error");
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
