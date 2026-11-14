// Browser smoke test (application test, not a runner test).
// Builds must exist (npm run build). Starts `vite preview`, drives Chromium through the
// three hundred-square games on tablet, phone and desktop viewports, and writes
// screenshots + a JSON report to reports/e2e/.
// The expected answers are computed here independently from the DOM (RTL rules:
// left +1, right −1, down +10, up −10), not taken from the app's own code.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, "..");
const outDir = resolve(webDir, "../../reports/e2e");
mkdirSync(outDir, { recursive: true });

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;
const AR = "٠١٢٣٤٥٦٧٨٩";
const toAr = (n) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)]);
const fromAr = (s) => Number(s.replace(/[٠-٩]/g, (d) => String(AR.indexOf(d))));
const results = [];

function check(name, cond, detail = "") {
  results.push({ name, pass: Boolean(cond), detail });
  if (!cond) throw new Error(`FAILED: ${name} ${detail}`);
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("preview server did not start");
}

async function playFragmentItem(page) {
  // Fill every blank via the on-screen number pad (touch path).
  const inputs = page.locator("input[data-cell]");
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const key = await inputs.nth(i).getAttribute("data-cell");
    const [row, col] = key.split(",").map(Number);
    const expected = row * 10 + col + 1;
    await inputs.nth(i).click();
    for (const d of String(expected)) await page.getByRole("button", { name: toAr(d), exact: true }).click();
  }
  await page.getByRole("button", { name: /تحقّق/ }).click();
  return page.getByTestId("feedback").getAttribute("data-kind");
}

async function targetOfLocate(page) {
  const text = await page.getByTestId("instruction").innerText();
  return fromAr(text.match(/[٠-٩]+/)[0]);
}

async function pathAnswer(page) {
  const startText = await page.getByTestId("path-start").innerText();
  let n = fromAr(startText.match(/[٠-٩]+/)[0]);
  const steps = await page.locator('[aria-label^="الخطوة"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  for (const s of steps) {
    if (s.includes("يسار")) n += 1;
    else if (s.includes("يمين")) n -= 1;
    else if (s.includes("أسفل")) n += 10;
    else if (s.includes("أعلى")) n -= 10;
  }
  return n;
}

async function run(label, contextOptions) {
  const browser = await chromium.launch();
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(`${BASE}?seeds=11,12,13,14,15`);
  check(`${label}: page is RTL Arabic`, (await page.getAttribute("html", "dir")) === "rtl" && (await page.getAttribute("html", "lang")) === "ar");
  check(`${label}: unreviewed content is labelled as draft`, await page.getByTestId("review-banner").isVisible());
  check(`${label}: home lists the 4 units of semester 1`, (await page.locator("[data-unit]").count()) === 4);
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(`${label}: no horizontal scroll on home`, noHScroll);
  await page.screenshot({ path: `${outDir}/${label}-1-home.png` });
  await page.locator('[data-unit="MATH-S1-U1A"]').click();
  check(`${label}: unit 1A lists 14 lessons`, (await page.locator("[data-lesson]").count()) === 14);
  await page.locator('[data-lesson="MATH-S1-U1A-L01"]').click();
  check(`${label}: lesson shows its book source`, (await page.getByTestId("source-ref").innerText()).includes("ص ٤"));

  // --- Game 1: fragment fill (touch / number pad) ---
  await page.locator('[data-game="GME-MATH-S1-L01-FRAGMENT"]').click();
  check(`${label}: fragment item answered correctly via number pad`, (await playFragmentItem(page)) === "correct");
  await page.screenshot({ path: `${outDir}/${label}-2-fragment.png` });
  await page.getByRole("button", { name: /رجوع/ }).click();

  // --- Game 2: locate (keyboard only) ---
  await page.locator('[data-game="GME-MATH-S1-L01-LOCATE"]').click();
  const topRight = page.locator('button[data-row="0"][data-screen-col="9"]');
  check(`${label}: number 1 is in the top-right corner (RTL like the book)`, (await topRight.innerText()) === "١");
  const target = await targetOfLocate(page);
  const row = Math.floor((target - 1) / 10);
  const screenCol = 9 - ((target - 1) % 10);
  await topRight.focus();
  for (let i = 0; i < row; i++) await page.keyboard.press("ArrowDown");
  for (let i = 0; i < 9 - screenCol; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  check(`${label}: locate ${target} with arrow keys + Enter`, (await page.getByTestId("feedback").getAttribute("data-kind")) === "correct");
  await page.screenshot({ path: `${outDir}/${label}-3-locate.png` });
  await page.getByRole("button", { name: /رجوع/ }).click();

  // --- Game 3: path move, wrong then right, while OFFLINE ---
  await context.setOffline(true);
  await page.locator('[data-game="GME-MATH-S1-L01-PATH"]').click();
  const answer = await pathAnswer(page);
  const options = page.locator("section button").filter({ hasText: /^[٠-٩]+$/ });
  const values = await options.evaluateAll((els) => els.map((e) => e.textContent));
  const wrongIndex = values.findIndex((v) => fromAr(v) !== answer);
  await options.nth(wrongIndex).click();
  check(`${label}: wrong choice gives gentle retry`, (await page.getByTestId("feedback").getAttribute("data-kind")) === "wrong");
  await page.getByRole("button", { name: /تلميح/ }).click();
  check(`${label}: hint shown`, await page.getByTestId("hint").isVisible());
  await options.nth(values.findIndex((v) => fromAr(v) === answer)).click();
  check(`${label}: correct on second try (offline)`, (await page.getByTestId("feedback").getAttribute("data-kind")) === "correct");
  await page.screenshot({ path: `${outDir}/${label}-4-path.png` });

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ghaith.attempts.v1") || "[]"));
  check(`${label}: 4 attempts saved locally while offline`, stored.length === 4, `found ${stored.length}`);
  check(
    `${label}: attempts carry seed, generator and error types`,
    stored.every((a) => Number.isInteger(a.seed) && a.generatorId && Array.isArray(a.errorTypes)) &&
      stored.some((a) => a.tryNumber === 2 && a.correct && a.hintsUsed === 1),
  );
  await context.setOffline(false);

  // --- Persistence after reload, progress view ---
  await page.reload();
  await page.getByRole("button", { name: /التقدّم/ }).click();
  check(`${label}: progress survives reload`, (await page.locator("[data-skill]").count()) === 2);
  await page.screenshot({ path: `${outDir}/${label}-5-progress.png` });

  check(`${label}: no console/page errors`, errors.length === 0, errors.join(" | "));
  await browser.close();
}

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: webDir, stdio: "ignore" });
let failed = false;
try {
  await waitForServer();
  await run("tablet", { ...devices["iPad (gen 7) landscape"], deviceScaleFactor: 2 });
  await run("phone", { ...devices["Pixel 7"] });
  await run("desktop", { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
} catch (e) {
  failed = true;
  console.error(String(e));
} finally {
  server.kill();
  const report = { at: new Date().toISOString(), passed: results.filter((r) => r.pass).length, total: results.length, failed, results };
  writeFileSync(`${outDir}/smoke-report.json`, JSON.stringify(report, null, 2));
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
  console.log(`${report.passed}/${report.total} checks passed${failed ? " — FAILED" : ""}`);
  process.exit(failed ? 1 : 0);
}
