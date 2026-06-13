import Phaser from "phaser";
import { DESIGN } from "./config/balance";
import { Palette } from "./config/theme";
import { Services } from "./systems/Services";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { UIScene } from "./scenes/UIScene";
import { DeathScene } from "./scenes/DeathScene";
import { ShopScene } from "./scenes/ShopScene";
import { LeaderboardScene } from "./scenes/LeaderboardScene";

// One service container for the whole app, shared via the Phaser registry.
const services = new Services();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // WebGL where available (BRIEF §2)
  parent: "game",
  backgroundColor: Phaser.Display.Color.IntegerToColor(Palette.ink).rgba,
  scale: {
    mode: Phaser.Scale.FIT, // letterbox the 720×1280 design space to any screen
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN.width,
    height: DESIGN.height,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: "high-performance",
  },
  // Let the renderer run at the display's refresh rate (60 or 120 ProMotion).
  // All movement is delta-time based so the feel is identical either way.
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  callbacks: {
    preBoot: (game) => {
      game.registry.set("services", services);
    },
  },
  scene: [
    BootScene,
    MenuScene,
    GameScene,
    UIScene,
    DeathScene,
    ShopScene,
    LeaderboardScene,
  ],
};

const game = new Phaser.Game(config);

// Expose for debugging / automated smoke tests (harmless in production).
const dbg = globalThis as unknown as { __GAME__: Phaser.Game; __SERVICES__: Services };
dbg.__GAME__ = game;
dbg.__SERVICES__ = services;

// Hide the HTML boot splash once the canvas is up.
window.addEventListener("load", () => {
  const splash = document.getElementById("boot-splash");
  if (splash) {
    setTimeout(() => splash.classList.add("hidden"), 250);
    setTimeout(() => splash.remove(), 900);
  }
});
