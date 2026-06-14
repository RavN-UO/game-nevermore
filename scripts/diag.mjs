/** Audit test: restart-after-death cycles (freeze repro) + shop buying.
 * Death is forced (headless software-GL runs the loop too slowly to die
 * naturally in a reasonable time); this isolates the restart lifecycle. */
import { chromium } from "playwright";

const URL = process.env.SMOKE_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
});
const S = 412 / 720, OY = 91, xy = (dx, dy) => [dx * S, OY + dy * S];

let failures = 0;
const errors = [];
const check = (n, ok, x = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${x ? "  " + x : ""}`); if (!ok) failures++; };
async function tap(page, dx, dy) { const [x, y] = xy(dx, dy); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); await page.waitForTimeout(70); }
async function tapXY(page, x, y) { await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); await page.waitForTimeout(70); }
async function waitScene(page, k, t = 6000) { try { await page.waitForFunction((key) => window.__GAME__.scene.isActive(key), k, { timeout: t, polling: 80 }); return true; } catch { return false; } }
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") { const t = m.text(); if (!/Failed to load resource|ERR_CERT|net::/.test(t)) errors.push("console: " + t); } });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => window.__GAME__ && window.__GAME__.isBooted, { timeout: 15000 });
  await page.waitForTimeout(500);
  await tap(page, 360, 590);
  await waitScene(page, "Menu", 6000);
  await page.waitForTimeout(800);
  return { ctx, page };
}

// --- Restart-after-death cycles (the reported freeze) ---
{
  const { ctx, page } = await fresh();
  await tap(page, 360, 0.64 * 1280);
  let ok = await waitScene(page, "Game");
  check("PLAY starts a run", ok);
  for (let cycle = 1; cycle <= 4 && ok; cycle++) {
    await page.evaluate(() => { const gs = window.__GAME__.scene.getScene("Game"); gs.invuln = 0; gs.crowY = 5000; });
    if (!(await waitScene(page, "Death", 6000))) { check(`cycle ${cycle}: reached death`, false); break; }
    await page.waitForTimeout(500);
    await tap(page, 360, 640); // tap centre to restart
    // poll for a fresh, live run (Death gone, Game alive & not dead)
    ok = await page.waitForFunction(() => {
      const g = window.__GAME__; const gs = g.scene.getScene("Game");
      return !g.scene.isActive("Death") && g.scene.isActive("Game") && gs && !gs.dead && gs.running;
    }, { timeout: 6000, polling: 80 }).then(() => true).catch(() => false);
    check(`cycle ${cycle}: clean restart, run live (no freeze)`, ok);
  }
  await ctx.close();
}

// --- Shop: open via Plumes, switch tabs, buy an upgrade in place ---
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => { const s = window.__SERVICES__.save.get(); s.plumes = 9999; window.__SERVICES__.save.flush(); });
  await tap(page, 620, 56);
  check("Plumes opens shop", await waitScene(page, "Shop"));
  // tap UPGRADES tab via its real position
  const tabPos = await page.evaluate(() => {
    const sc = window.__GAME__.scene.getScene("Shop");
    const c = document.querySelector("canvas").getBoundingClientRect();
    const sx = c.width / window.__GAME__.scale.width, sy = c.height / window.__GAME__.scale.height;
    const t = sc.children.list.find((o) => o.type === "Container" && Math.round(o.x) > 360 && Math.round(o.y) === 156)
      || sc.body?.list?.find?.((o) => o.type === "Container" && Math.round(o.x) > 360 && Math.round(o.y) === 156);
    return t ? [c.left + t.x * sx, c.top + t.y * sy] : null;
  });
  if (tabPos) await tapXY(page, tabPos[0], tabPos[1]);
  await page.waitForTimeout(300);
  // find the first upgrade row's screen position
  const rowPos = await page.evaluate(() => {
    const sc = window.__GAME__.scene.getScene("Shop");
    const c = document.querySelector("canvas").getBoundingClientRect();
    const sx = c.width / window.__GAME__.scale.width, sy = c.height / window.__GAME__.scale.height;
    const rows = sc.body.list.filter((o) => o.type === "Container" && o.input && Math.round(o.y) > 200).sort((a, b) => a.y - b.y);
    const r = rows[0];
    return r ? [c.left + r.x * sx, c.top + r.y * sy] : null;
  });
  const before = await page.evaluate(() => window.__SERVICES__.save.get().upgrades.magnet ?? 0);
  if (rowPos) await tapXY(page, rowPos[0], rowPos[1]);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__SERVICES__.save.get().upgrades.magnet ?? 0);
  check("buying an upgrade works (in place)", after === before + 1, `(${before}->${after})`);
  check("still on Shop after buying", await page.evaluate(() => window.__GAME__.scene.isActive("Shop")));
  await ctx.close();
}

await browser.close();
if (errors.length) { console.log("\nERRORS:\n" + errors.slice(0, 10).join("\n")); failures += errors.length; }
console.log(failures === 0 ? "\n✅ AUDIT TESTS PASSED" : `\n❌ ${failures} ISSUE(S)`);
process.exit(failures ? 1 : 0);
