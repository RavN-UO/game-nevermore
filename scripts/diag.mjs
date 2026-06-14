/** Interaction test. Taps are move+down+gap+up so the headless input plugin
 * processes the press across frames (a real device tap has natural timing). */
import { chromium } from "playwright";

const URL = process.env.SMOKE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});

const S = 412 / 720;
const OY = 91;
const xy = (dx, dy) => [dx * S, OY + dy * S];

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${extra ? "  " + extra : ""}`);
  if (!ok) failures++;
};
async function tap(page, dx, dy) {
  const [x, y] = xy(dx, dy);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  await page.waitForTimeout(70);
}
async function waitScene(page, key, timeout = 5000) {
  try { await page.waitForFunction((k) => window.__GAME__.scene.isActive(k), key, { timeout, polling: 100 }); return true; }
  catch { return false; }
}
async function freshMenu() {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { console.log("PAGEERROR:", e.message); failures++; });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.isBooted, { timeout: 15000 });
  await page.waitForTimeout(500);
  await tap(page, 360, 590);
  await waitScene(page, "Menu", 6000);
  await page.waitForTimeout(900);
  return { ctx, page };
}
const panels = (page) => page.evaluate(() => window.__GAME__.scene.getScene("Menu").children.list.filter((o) => o.depth >= 100).length);

{ const { ctx, page } = await freshMenu(); await tap(page, 360, 0.64 * 1280); check("PLAY launches the game", await waitScene(page, "Game")); await ctx.close(); }
{ const { ctx, page } = await freshMenu(); await tap(page, 620, 56); check("Plumes counter opens the Shop", await waitScene(page, "Shop")); await ctx.close(); }
{ const { ctx, page } = await freshMenu(); await tap(page, 360, 0.735 * 1280); check("RANKS opens the Leaderboard", await waitScene(page, "Leaderboard")); await ctx.close(); }
{
  const { ctx, page } = await freshMenu();
  await tap(page, 664, 1224); check("settings panel opens", (await panels(page)) >= 1);
  await tap(page, 360, 640 + 175); check("settings CLOSE works", (await panels(page)) === 0);
  await tap(page, 360, 0.64 * 1280); check("menu still interactive after settings", await waitScene(page, "Game"));
  await ctx.close();
}
{
  const { ctx, page } = await freshMenu();
  await tap(page, 360, 0.64 * 1280);
  if (await waitScene(page, "Game")) { await tap(page, 360, 640); await page.waitForTimeout(2600); check("run reaches the Death/reward screen", await waitScene(page, "Death", 9000)); }
  else check("run reaches the Death/reward screen", false, "(game never started)");
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? "\n✅ ALL INTERACTION TESTS PASSED" : `\n❌ ${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
