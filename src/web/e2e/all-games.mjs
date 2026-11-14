// Browser sweep over EVERY game of the math S1 catalogue (application test).
// For each game: open it by deep link, read the expected answer exposed only with
// ?e2e=1, answer through the real widgets (number pad, option buttons, ordering, or
// the visual's own interaction), and require «correct» feedback with no console errors.
// Also exercises a worked example and a unit mission. Report: reports/e2e/all-games-report.json
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(here, "..");
const root = resolve(webDir, "../..");
const outDir = resolve(root, "reports/e2e");
mkdirSync(outDir, { recursive: true });
const catalog = JSON.parse(readFileSync(resolve(root, "content/curriculum/math/s1/lessons.json"), "utf8"));
const LEGACY = new Set(["hsq-fragment", "hsq-locate", "hsq-path"]);
const PORT = 4174;
const BASE = `http://127.0.0.1:${PORT}/`;
const AR = "٠١٢٣٤٥٦٧٨٩";
const toAr = (n) => String(n).replace(/[0-9]/g, (d) => AR[Number(d)]);

/** Interactions for visual-input mechanics, keyed by mechanic id. Each answers with `solution`. */
const VISUAL_DRIVERS = {
  async "hsq-pattern"(page, solution) {
    const col = 9 - solution.col; // RTL: logical col 0 is the right edge
    await page.locator(`button[data-row="${solution.row}"][data-screen-col="${col}"]`).click();
    await confirmIfPresent(page);
  },
  async "symmetry-complete"(page, solution) {
    for (const key of solution) await page.locator(`[data-cell-key="${key}"]`).click();
    await confirmIfPresent(page);
  },
  async "array-build"(page, solution) {
    await page.locator(`[data-array-cell="${solution.rows - 1},${solution.cols - 1}"]`).click();
    await confirmIfPresent(page);
  },
  async "digit-sentence"(page, solution) {
    for (const id of solution) await page.locator(`[data-card-id="${id}"]`).click();
    await confirmIfPresent(page);
  },
  async "numberline-place"(page, solution) {
    await page.locator(`[data-testid="numberline-place"]`).evaluate((el, value) => el.dispatchEvent(new CustomEvent("e2e-place", { detail: value })), solution);
    await confirmIfPresent(page);
  },
};

async function confirmIfPresent(page) {
  const btn = page.getByRole("button", { name: /تحقّق/ });
  if ((await btn.count()) > 0 && (await btn.first().isEnabled())) await btn.first().click();
}

async function answer(page, mechanic) {
  const raw = await page.getByTestId("e2e-solution").textContent();
  const { solution, input } = JSON.parse(raw);
  if (input === "number") {
    for (const d of String(solution)) await page.getByRole("button", { name: toAr(d), exact: true }).click();
    await page.getByRole("button", { name: /تحقّق/ }).click();
  } else if (input === "choice") {
    await page.locator(`[data-option="${solution}"]`).click();
  } else if (input === "multi" || input === "order") {
    for (const id of solution) await page.locator(`[data-option="${id}"]`).click();
    await page.getByRole("button", { name: /تحقّق/ }).click();
  } else if (input === "visual") {
    const driver = VISUAL_DRIVERS[mechanic];
    if (!driver) return "no-driver";
    await driver(page, solution);
  }
  await page.getByTestId("feedback").waitFor({ timeout: 4000 });
  return page.getByTestId("feedback").getAttribute("data-kind");
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("preview server did not start");
}

const results = [];
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: webDir, stdio: "ignore" });
let fatal = null;
try {
  await waitForServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPad (gen 7) landscape"] });
  const page = await context.newPage();
  let errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  for (const lesson of catalog.lessons) {
    for (const game of lesson.games) {
      if (LEGACY.has(game.mechanic)) continue; // covered by smoke.mjs
      errors = [];
      const r = { lesson: lesson.lesson_id, game: game.game_id, mechanic: game.mechanic, items: [] };
      try {
        await page.goto(`${BASE}?lesson=${lesson.lesson_id}&game=${game.game_id}&e2e=1&seeds=7,8,9,10,11`);
        await page.getByTestId("quiz").waitFor({ timeout: 5000 });
        for (let i = 0; i < 2; i++) {
          const kind = await answer(page, game.mechanic);
          r.items.push(kind);
          if (kind !== "correct") break;
          await page.getByRole("button", { name: /التالي/ }).click();
        }
        r.pass = r.items.length === 2 && r.items.every((k) => k === "correct") && errors.length === 0;
      } catch (e) {
        r.pass = false;
        r.error = String(e).slice(0, 300);
      }
      r.errors = errors.slice(0, 3);
      results.push(r);
      process.stdout.write(r.pass ? "." : "F");
    }
  }
  process.stdout.write("\n");

  // Worked example + unit mission for unit 1A.
  await page.goto(`${BASE}?lesson=MATH-S1-U1A-L05&e2e=1`);
  await page.getByTestId("example").click();
  const steps = await page.getByTestId("worked-example").locator("li").count();
  results.push({ lesson: "MATH-S1-U1A-L05", game: "worked-example", pass: steps >= 2, items: [`${steps} steps`] });
  await page.goto(`${BASE}?e2e=1`);
  await page.locator('[data-unit="MATH-S1-U1B"]').click();
  await page.getByTestId("mission").click();
  const missionKinds = [];
  for (let i = 0; i < 20; i++) {
    if ((await page.getByTestId("quiz").count()) === 0) break;
    const mech = await page.getByTestId("quiz").getAttribute("data-mechanic");
    missionKinds.push(await answer(page, mech));
    const nextBtn = page.getByRole("button", { name: /التالي|إنهاء/ });
    await nextBtn.click();
  }
  const done = (await page.getByTestId("round-done").count()) === 1;
  results.push({ lesson: "MATH-S1-U1B", game: "unit-mission", pass: done && missionKinds.length > 0 && missionKinds.every((k) => k === "correct"), items: missionKinds });
  await page.screenshot({ path: `${outDir}/all-games-mission-done.png` });
  await browser.close();
} catch (e) {
  fatal = String(e);
} finally {
  server.kill();
  const failed = results.filter((r) => !r.pass);
  const report = { at: new Date().toISOString(), total: results.length, passed: results.length - failed.length, fatal, failed, results };
  writeFileSync(`${outDir}/all-games-report.json`, JSON.stringify(report, null, 2));
  for (const f of failed) console.log("FAIL", f.lesson, f.game, f.mechanic ?? "", JSON.stringify(f.items), f.error ?? "", (f.errors ?? []).join(" | "));
  console.log(`${report.passed}/${report.total} passed${fatal ? " — FATAL " + fatal : ""}`);
  process.exit(failed.length || fatal ? 1 : 0);
}
