import Phaser from "phaser";
import { Palette } from "../config/theme";
import { generateTextures, Tex } from "../gfx/TextureFactory";
import { displayStyle, textStyle, getServices } from "../ui/Widgets";

/**
 * First scene. Generates all procedural textures, waits for the web font, then
 * shows a tap-to-start gate. The tap is what unlocks the iOS AudioContext
 * (BRIEF §2 — audio can't start before a user gesture).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    generateTextures(this);
    const { width, height } = this.scale;

    this.add.image(width / 2, height / 2, Tex.sky).setDisplaySize(width, height);
    this.add.image(width / 2, height / 2, Tex.vignette).setDisplaySize(width, height).setDepth(50);

    // A lone raven drifting on the title screen
    this.add.image(width / 2, height * 0.34, Tex.glow).setScale(4.5).setAlpha(0.28).setTint(Palette.accent).setBlendMode(Phaser.BlendModes.ADD);
    const crow = this.add.image(width / 2, height * 0.34, Tex.crow0).setScale(1.6).setTint(Palette.crow);
    crow.setAngle(-6);
    this.tweens.add({ targets: crow, y: crow.y - 18, angle: 6, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.inOut" });
    const eye = this.add.image(crow.x + 30, crow.y - 6, Tex.eye).setScale(0.7).setTint(Palette.accent).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: eye, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });

    const title = this.add
      .text(width / 2, height * 0.54, "NEVERMORE", displayStyle(76, Palette.bone))
      .setOrigin(0.5)
      .setLetterSpacing(8);
    title.setShadow(0, 0, "#7be0ff", 24, false, true);

    this.add
      .text(width / 2, height * 0.61, "guide the raven through the abyss", textStyle(24, Palette.smoke))
      .setOrigin(0.5)
      .setLetterSpacing(2);

    const prompt = this.add
      .text(width / 2, height * 0.78, "TAP TO BEGIN", textStyle(30, Palette.accent))
      .setOrigin(0.5)
      .setLetterSpacing(4);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 800, yoyo: true, repeat: -1, ease: "Sine.inOut" });

    // Make sure the web font is applied to canvas text once it loads.
    const refreshFont = () => {
      title.updateText();
    };
    if (document.fonts?.ready) document.fonts.ready.then(refreshFont).catch(() => {});

    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      const svc = getServices(this);
      void svc.audio.unlock().then(() => svc.audio.playMenu());
      this.cameras.main.fadeOut(280, 5, 5, 12);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("Menu");
      });
    };
    this.input.once("pointerdown", begin);
  }
}
