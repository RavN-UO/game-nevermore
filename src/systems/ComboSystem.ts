import { Balance } from "../config/balance";
import { eventBus, GameEvent } from "./EventBus";

/**
 * The combo / multiplier — one of the core addictive levers (BRIEF §1.2).
 * Collecting souls raises the multiplier; going too long without a soul makes it
 * decay; death resets it. The multiplier scales BOTH score and Plumes.
 */
export class ComboSystem {
  private step = 0; // 0 → ×1, 1 → ×2 …
  private progress = 0; // souls toward the next step
  private sinceSoul = 0; // ms since last soul
  private drainAcc = 0; // ms accumulated while draining
  bestStep = 0;

  reset(): void {
    this.step = 0;
    this.progress = 0;
    this.sinceSoul = 0;
    this.drainAcc = 0;
    this.bestStep = 0;
    this.emit();
  }

  get multiplier(): number {
    return 1 + this.step * Balance.combo.step;
  }

  get bestMultiplier(): number {
    return 1 + this.bestStep * Balance.combo.step;
  }

  /** Call when a soul is collected. */
  collect(): void {
    this.sinceSoul = 0;
    this.drainAcc = 0;
    const maxStep = (Balance.combo.max - 1) / Balance.combo.step;
    if (this.step >= maxStep) {
      this.emit(true);
      return;
    }
    this.progress += 1;
    if (this.progress >= Balance.combo.perSouls) {
      this.progress = 0;
      this.step = Math.min(maxStep, this.step + 1);
      this.bestStep = Math.max(this.bestStep, this.step);
    }
    this.emit(true);
  }

  update(dtMs: number): void {
    if (this.step === 0 && this.progress === 0) return;
    this.sinceSoul += dtMs;
    if (this.sinceSoul < Balance.combo.decayMs) return;

    // decaying
    this.drainAcc += dtMs;
    if (this.drainAcc >= Balance.combo.drainMs) {
      this.drainAcc = 0;
      if (this.progress > 0) {
        this.progress = 0;
      } else if (this.step > 0) {
        this.step -= 1;
      }
      if (this.step === 0 && this.progress === 0) {
        eventBus().emit(GameEvent.ComboBreak);
      }
      this.emit();
    }
  }

  /** Fraction of the decay window remaining (1 = fresh, 0 = about to drop). */
  private freshness(): number {
    if (this.sinceSoul <= 0) return 1;
    const v = 1 - this.sinceSoul / Balance.combo.decayMs;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  private emit(popped = false): void {
    eventBus().emit(GameEvent.ComboUpdate, {
      multiplier: this.multiplier,
      step: this.step,
      progress: this.progress / Balance.combo.perSouls,
      freshness: this.freshness(),
      popped,
    });
  }
}
