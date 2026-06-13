/**
 * Headless smoke test: loads the built game, walks through every scene, plays a
 * short run (input + death + reward), and fails if any console error or
 * uncaught exception occurs. Screenshots are written to .smoke/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.env.SMOKE_URL || "http://localhost:4173";
mkdirSync(".smoke", { recursive: true });

const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });

const errors = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  // Ignore sandbox-only network/cert noise (e.g. blocked Google Fonts CDN).
  if (/Failed to load resource|ERR_CERT|net::|ERR_NETWORK/.test(t)) return;
  errors.push("console.error: " + t);
});
page.on("pageerror", (e) => errors.push("pageerror: " + (e.stack || e.message)));

const show = (key) =>
  page.evaluate((k) => {
    const g = window.__GAME__;
    const sm = g.scene;
    ["Boot", "Menu", "Game", "UI", "Death", "Shop", "Leaderboard"].forEach((s) => {
      if (sm.isActive(s) || sm.isPaused(s)) sm.stop(s);
    });
    sm.start(k);
  }, key);

const shot = (name) => page.screenshot({ path: `.smoke/${name}.png` });

try {
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.__GAME__ && window.__GAME__.isBooted, { timeout: 15000 });
  await page.waitForTimeout(1200);
  await shot("01-boot");

  // real boot gesture -> unlocks + builds the Tone.js audio graph
  await page.mouse.click(206, 460);
  await page.waitForTimeout(1500);
  const audio = await page.evaluate(() => {
    const a = window.__SERVICES__.audio;
    return { ready: a.isReady, error: a.lastError };
  });
  console.log("Audio engine ready:", audio.ready, audio.error ? `(error: ${audio.error})` : "");
  if (audio.error) errors.push("audio init: " + audio.error);

  for (const scene of ["Menu", "Shop", "Leaderboard"]) {
    await show(scene);
    await page.waitForTimeout(1100);
    await shot(`02-${scene.toLowerCase()}`);
  }

  // play a run: start, hold to dive, release, let it die into the reward screen
  await show("Game");
  await page.waitForTimeout(400);
  await page.mouse.move(206, 460);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.waitForTimeout(700);
  await shot("03-game");
  // let physics carry it to death + reward overlay
  await page.waitForTimeout(4000);
  await shot("04-death");

  const deathActive = await page.evaluate(() => window.__GAME__.scene.isActive("Death"));

  console.log("Death scene reached:", deathActive);
} catch (e) {
  errors.push("script: " + (e.stack || e.message));
}

await browser.close();

if (errors.length) {
  console.error("\n❌ SMOKE FAILED — runtime errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("\n✅ SMOKE PASSED — no console errors or exceptions.");
