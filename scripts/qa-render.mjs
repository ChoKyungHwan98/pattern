import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const toolsRoot = path.resolve(scriptDirectory, "..", "..");
const playwrightEntry = path.join(
  toolsRoot,
  "테이블 디자이너",
  "node_modules",
  "playwright",
  "index.mjs",
);
const { chromium } = await import(pathToFileURL(playwrightEntry).href);

const url = process.argv[2] ?? "http://127.0.0.1:4320/";
const screenshotPath = process.argv[3];
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1600, height: 960 } });
const errors = [];

page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
    errors.push(`console: ${message.text()}`);
  }
});
page.on("requestfailed", (request) => {
  errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
});

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  await page.getByText("Cinder Knight", { exact: true }).first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
  await page.getByText("Cinder Knight Combat HFSM", { exact: true }).first().waitFor({
    state: "visible",
    timeout: 10_000,
  });
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  await page.getByRole("button", { name: /노드 추가/ }).click();
  await page.getByText("8 nodes", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /자동 배치/ }).click();
  await page.waitForTimeout(250);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  console.log("PASS: HFSM 렌더링, 노드 추가, 자동 배치가 정상 동작했습니다.");
} finally {
  await browser.close();
}
