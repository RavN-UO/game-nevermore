import * as Tone from "tone";

/**
 * Procedural audio engine (BRIEF §2 bis). Every sound — SFX and the adaptive
 * music bed — is synthesised at runtime with Tone.js. No audio files at all.
 *
 * Design notes to hit the "must sound good, no cheap placeholders" bar:
 *  - Master chain ends in a Limiter so layered synths never clip.
 *  - Music + SFX have their own reverb sends for depth.
 *  - SFX are layered (transient + body + tail) with worked envelopes, filtering
 *    and small random pitch detune so repeats don't sound mechanical.
 *  - Music is adaptive: five layers (pad, sub, arp, perc, lead) cross-fade in
 *    as the difficulty tier rises, and the tempo creeps up with it. The loops
 *    run continuously on the Transport — only their gains change — so there are
 *    no audible loop seams and no scheduling churn.
 *
 * iOS unlock: nothing makes sound until `unlock()` is called from a user
 * gesture (the tap-to-start screen), which resumes the AudioContext.
 */

type Tier = number; // 0..4

// Dm – Bb – F – Am, a dark, classic minor loop.
const CHORDS: string[][] = [
  ["D3", "F3", "A3"],
  ["Bb2", "D3", "F3"],
  ["F2", "A2", "C3"],
  ["A2", "C3", "E3"],
];
const BASS_ROOTS = ["D1", "Bb0", "F1", "A1"];
// Lead motif (null = rest), looped; sits over the chord bed.
const LEAD: (string | null)[] = [
  "A4", null, "F4", "G4", null, "A4", "C5", null,
  "D5", null, "C5", "A4", "G4", null, "F4", null,
];
// Pentatonic-ish collect notes; index rises with the combo for a "ladder" feel.
const COLLECT_NOTES = ["D4", "F4", "G4", "A4", "C5", "D5", "F5", "G5", "A5", "C6", "D6", "F6"];

// Per-layer gain targets for tiers 0..4.
const TIER_GAINS = {
  pad: [0.5, 0.58, 0.6, 0.64, 0.68],
  sub: [0.0, 0.5, 0.58, 0.62, 0.66],
  arp: [0.0, 0.0, 0.42, 0.5, 0.56],
  perc: [0.0, 0.0, 0.36, 0.5, 0.62],
  lead: [0.0, 0.0, 0.0, 0.42, 0.56],
};
const TIER_BPM = [82, 90, 99, 109, 120];

export class AudioManager {
  private ready = false;
  private starting = false;
  /** Last init error, exposed for diagnostics / smoke tests (null if healthy). */
  lastError: string | null = null;

  private musicBus!: Tone.Gain;
  private sfxBus!: Tone.Gain;

  private musicVol: number;
  private sfxVol: number;

  // music
  private layers!: Record<keyof typeof TIER_GAINS, Tone.Gain>;
  private padSynth!: Tone.PolySynth;
  private subSynth!: Tone.MonoSynth;
  private arpSynth!: Tone.Synth;
  private leadSynth!: Tone.Synth;
  private kick!: Tone.MembraneSynth;
  private hat!: Tone.NoiseSynth;
  private loops: Tone.Loop[] = [];
  private chordIndex = 0;
  private arpStep = 0;
  private bassStep = 0;
  private leadStep = 0;
  private percStep = 0;
  private currentTier: Tier = 0;
  private mode: "off" | "menu" | "game" = "off";

  // sfx
  private collectSynth!: Tone.Synth;
  private collectBell!: Tone.FMSynth;
  private whoosh!: Tone.NoiseSynth;
  private whooshFilter!: Tone.Filter;
  private deathTone!: Tone.Synth;
  private deathImpact!: Tone.MembraneSynth;
  private uiSynth!: Tone.Synth;
  private chime!: Tone.PolySynth;
  private clang!: Tone.FMSynth;

  constructor(musicVol: number, sfxVol: number) {
    this.musicVol = musicVol;
    this.sfxVol = sfxVol;
  }

  /** Resume the AudioContext + build the graph. Call from a user gesture. */
  async unlock(): Promise<void> {
    if (this.ready || this.starting) return;
    this.starting = true;
    // iOS 16.4+: play through the "playback" session so the SILENT/MUTE switch
    // doesn't kill game audio (the #1 cause of "no sound" on iPhone web).
    try {
      const ns = navigator as unknown as { audioSession?: { type: string } };
      if (ns.audioSession) ns.audioSession.type = "playback";
    } catch {
      /* not supported — falls back to default behaviour */
    }
    try {
      await Tone.start();
      await this.resume();
      this.build();
      this.ready = true;
      // iOS suspends the AudioContext when backgrounded or sometimes mid-session.
      // Re-resume on any tap and when the tab returns to the foreground.
      window.addEventListener("pointerdown", () => void this.resume(), { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) void this.resume();
      });
    } catch (e) {
      this.ready = false;
      this.lastError = e instanceof Error ? e.message : String(e);
    } finally {
      this.starting = false;
    }
  }

  /** Resume the underlying AudioContext if the browser has suspended it. */
  async resume(): Promise<void> {
    try {
      const ctx = Tone.getContext();
      if (ctx.state !== "running") await ctx.resume();
    } catch {
      /* ignore */
    }
  }

  get isReady(): boolean {
    return this.ready;
  }

  // -------------------------------------------------------------- build ----
  private build(): void {
    const limiter = new Tone.Limiter(-1).toDestination();

    const musicReverb = new Tone.Reverb({ decay: 7, wet: 0.34, preDelay: 0.02 });
    musicReverb.connect(limiter);
    this.musicBus = new Tone.Gain(this.musicVol).connect(musicReverb);
    // dry path too, so music isn't all wash
    this.musicBus.connect(limiter);

    const sfxReverb = new Tone.Reverb({ decay: 2.6, wet: 0.18 });
    sfxReverb.connect(limiter);
    this.sfxBus = new Tone.Gain(this.sfxVol).connect(sfxReverb);
    this.sfxBus.connect(limiter);

    this.buildMusic();
    this.buildSfx();
  }

  private buildMusic(): void {
    this.layers = {
      pad: new Tone.Gain(0).connect(this.musicBus),
      sub: new Tone.Gain(0).connect(this.musicBus),
      arp: new Tone.Gain(0).connect(this.musicBus),
      perc: new Tone.Gain(0).connect(this.musicBus),
      lead: new Tone.Gain(0).connect(this.musicBus),
    };

    this.padSynth = new Tone.PolySynth(Tone.Synth);
    this.padSynth.set({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 1.4, decay: 0.4, sustain: 0.85, release: 3 },
      volume: -16,
    });
    const padFilter = new Tone.Filter(900, "lowpass").connect(this.layers.pad);
    this.padSynth.connect(padFilter);

    this.subSynth = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.4 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, baseFrequency: 80, octaves: 2 },
      volume: -8,
    }).connect(this.layers.sub);

    this.arpSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.16, sustain: 0.05, release: 0.2 },
      volume: -14,
    });
    const arpFilter = new Tone.Filter(2400, "lowpass").connect(this.layers.arp);
    const arpDelay = new Tone.FeedbackDelay("8n.", 0.28).connect(arpFilter);
    this.arpSynth.connect(arpDelay);

    this.leadSynth = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.5 },
      volume: -16,
    });
    const leadFilter = new Tone.Filter(2000, "lowpass").connect(this.layers.lead);
    this.leadSynth.connect(leadFilter);

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
      volume: -6,
    }).connect(this.layers.perc);
    this.hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -22,
    });
    const hatFilter = new Tone.Filter(7000, "highpass").connect(this.layers.perc);
    this.hat.connect(hatFilter);

    const t = Tone.getTransport();
    t.bpm.value = TIER_BPM[0];

    // Pad: a sustained chord every two measures, advancing the progression.
    this.loops.push(
      new Tone.Loop((time) => {
        const chord = CHORDS[this.chordIndex % CHORDS.length];
        this.padSynth.triggerAttackRelease(chord, "2m", time, 0.5);
        this.chordIndex++;
      }, "2m").start(0),
    );

    // Sub bass: root pulse with a little syncopation.
    this.loops.push(
      new Tone.Loop((time) => {
        const root = BASS_ROOTS[(this.chordIndex - 1 + CHORDS.length) % CHORDS.length];
        const pat = [1, 0, 1, 1, 0, 1, 0, 1];
        if (pat[this.bassStep % pat.length]) {
          this.subSynth.triggerAttackRelease(root, "8n", time, 0.9);
        }
        this.bassStep++;
      }, "8n").start(0),
    );

    // Arp: walks the current chord up and down in sixteenths.
    this.loops.push(
      new Tone.Loop((time) => {
        const chord = CHORDS[(this.chordIndex - 1 + CHORDS.length) % CHORDS.length];
        const seq = [...chord, chord[1]];
        const note = seq[this.arpStep % seq.length];
        const oct = Math.floor(this.arpStep / seq.length) % 2 === 1 ? "5" : "4";
        const n = note.replace(/\d/, oct);
        this.arpSynth.triggerAttackRelease(n, "16n", time, 0.6);
        this.arpStep++;
      }, "16n").start(0),
    );

    // Perc: kick on the strong beats, hats on the offbeats.
    this.loops.push(
      new Tone.Loop((time) => {
        const s = this.percStep % 8;
        if (s === 0 || s === 4) this.kick.triggerAttackRelease("C1", "8n", time, 0.9);
        if (s % 2 === 1) this.hat.triggerAttackRelease("16n", time, 0.5 + Math.random() * 0.2);
        this.percStep++;
      }, "8n").start(0),
    );

    // Lead: the motif, looping, with rests.
    this.loops.push(
      new Tone.Loop((time) => {
        const n = LEAD[this.leadStep % LEAD.length];
        if (n) this.leadSynth.triggerAttackRelease(n, "8n", time, 0.7);
        this.leadStep++;
      }, "8n").start(0),
    );
  }

  private buildSfx(): void {
    this.collectSynth = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.1 },
      volume: -10,
    }).connect(this.sfxBus);

    this.collectBell = new Tone.FMSynth({
      harmonicity: 3.5,
      modulationIndex: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
      modulation: { type: "sine" },
      modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
      volume: -18,
    }).connect(this.sfxBus);

    this.whooshFilter = new Tone.Filter(1200, "bandpass");
    this.whooshFilter.Q.value = 1.4;
    this.whooshFilter.connect(this.sfxBus);
    this.whoosh = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.01, decay: 0.18, sustain: 0, release: 0.1 },
      volume: -16,
    }).connect(this.whooshFilter);

    this.deathTone = new Tone.Synth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0.1, release: 0.4 },
      volume: -10,
    }).connect(this.sfxBus);
    this.deathImpact = new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0 },
      volume: -4,
    }).connect(this.sfxBus);

    this.uiSynth = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: -20,
    }).connect(this.sfxBus);

    this.chime = new Tone.PolySynth(Tone.Synth);
    this.chime.set({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0.1, release: 0.6 },
      volume: -14,
    });
    this.chime.connect(this.sfxBus);

    this.clang = new Tone.FMSynth({
      harmonicity: 5.1,
      modulationIndex: 14,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 },
      modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 },
      volume: -12,
    }).connect(this.sfxBus);
  }

  // ------------------------------------------------------------- music ----
  playMenu(): void {
    if (!this.ready) return;
    this.mode = "menu";
    Tone.getTransport().start();
    Tone.getTransport().bpm.rampTo(74, 1.5);
    this.layers.pad.gain.rampTo(0.5, 2);
    this.layers.sub.gain.rampTo(0.0, 1);
    this.layers.arp.gain.rampTo(0.18, 2);
    this.layers.perc.gain.rampTo(0.0, 1);
    this.layers.lead.gain.rampTo(0.0, 1);
  }

  playGame(): void {
    if (!this.ready) return;
    this.mode = "game";
    Tone.getTransport().start();
    this.currentTier = 0;
    this.applyTier(0, 0.6);
  }

  setIntensity(tier: Tier): void {
    if (!this.ready || this.mode !== "game") return;
    const t = Math.max(0, Math.min(TIER_BPM.length - 1, tier));
    if (t === this.currentTier) return;
    this.currentTier = t;
    this.applyTier(t, 2.5);
  }

  private applyTier(tier: Tier, ramp: number): void {
    (Object.keys(TIER_GAINS) as (keyof typeof TIER_GAINS)[]).forEach((k) => {
      this.layers[k].gain.rampTo(TIER_GAINS[k][tier], ramp);
    });
    Tone.getTransport().bpm.rampTo(TIER_BPM[tier], 4);
  }

  stopMusic(fade = 0.6): void {
    if (!this.ready) return;
    this.mode = "off";
    (Object.keys(this.layers) as (keyof typeof TIER_GAINS)[]).forEach((k) =>
      this.layers[k].gain.rampTo(0, fade),
    );
  }

  // --------------------------------------------------------------- sfx ----
  private static detune(synth: { detune: { value: number } }, cents: number): void {
    synth.detune.value = (Math.random() * 2 - 1) * cents;
  }

  sfxCollect(comboStep = 0): void {
    if (!this.ready) return;
    const i = Math.min(COLLECT_NOTES.length - 1, comboStep);
    const note = COLLECT_NOTES[i];
    AudioManager.detune(this.collectSynth, 12);
    this.collectSynth.triggerAttackRelease(note, "16n", undefined, 0.8);
    this.collectBell.triggerAttackRelease(note, "8n", undefined, 0.5);
  }

  sfxNearMiss(): void {
    if (!this.ready) return;
    const now = Tone.now();
    this.whooshFilter.frequency.cancelScheduledValues(now);
    this.whooshFilter.frequency.setValueAtTime(700, now);
    this.whooshFilter.frequency.exponentialRampToValueAtTime(2600, now + 0.18);
    this.whoosh.triggerAttackRelease("8n", now, 0.9);
  }

  sfxDeath(): void {
    if (!this.ready) return;
    const now = Tone.now();
    this.deathImpact.triggerAttackRelease("C1", "4n", now, 1);
    this.deathTone.triggerAttack("A3", now, 0.8);
    this.deathTone.frequency.exponentialRampToValueAtTime(55, now + 0.6);
    this.deathTone.triggerRelease(now + 0.55);
  }

  sfxShield(): void {
    if (!this.ready) return;
    this.clang.triggerAttackRelease("A4", "8n", undefined, 0.9);
  }

  sfxRevive(): void {
    if (!this.ready) return;
    const now = Tone.now();
    this.chime.triggerAttackRelease(["D4", "A4", "D5", "F5"], "2n", now, 0.7);
  }

  sfxMilestone(): void {
    if (!this.ready) return;
    this.chime.triggerAttackRelease(["D4", "F4", "A4"], "4n", undefined, 0.5);
  }

  sfxReward(): void {
    if (!this.ready) return;
    const now = Tone.now();
    ["D5", "F5", "A5", "D6"].forEach((n, i) =>
      this.chime.triggerAttackRelease(n, "8n", now + i * 0.08, 0.6),
    );
  }

  sfxUi(up = false): void {
    if (!this.ready) return;
    AudioManager.detune(this.uiSynth, 20);
    this.uiSynth.triggerAttackRelease(up ? "A5" : "E5", "32n", undefined, 0.5);
  }

  // ------------------------------------------------------------ volume ----
  setMusicVolume(v: number): void {
    this.musicVol = v;
    if (this.ready) this.musicBus.gain.rampTo(v, 0.1);
  }

  setSfxVolume(v: number): void {
    this.sfxVol = v;
    if (this.ready) this.sfxBus.gain.rampTo(v, 0.1);
  }
}
