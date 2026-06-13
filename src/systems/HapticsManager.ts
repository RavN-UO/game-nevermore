/**
 * Haptic feedback abstraction (BRIEF §2). Uses the native Capacitor Haptics
 * plugin when running inside a Capacitor app (reliable on iOS), and falls back
 * to the Web `navigator.vibrate` API in the browser/PWA (note: iOS Safari does
 * not currently support `vibrate`, so PWA haptics are Android-only — documented).
 */

type Pattern = "tick" | "light" | "medium" | "heavy" | "success" | "warning";

// Loosely-typed handle to the optional Capacitor Haptics plugin.
interface CapHaptics {
  impact: (opts: { style: string }) => Promise<void>;
  notification: (opts: { type: string }) => Promise<void>;
  vibrate: (opts: { duration: number }) => Promise<void>;
}

export class HapticsManager {
  private enabled = true;
  private cap: CapHaptics | null = null;
  private readonly canVibrate =
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  constructor(enabled: boolean) {
    this.enabled = enabled;
    void this.tryLoadCapacitor();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  private async tryLoadCapacitor(): Promise<void> {
    // Only present in a Capacitor build; ignored in the PWA.
    const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
    if (!w.Capacitor?.isNativePlatform?.()) return;
    try {
      // Non-literal specifier so the bundler/TS don't try to resolve a plugin
      // that only exists in a Capacitor build (see BRIEF §6 / phase 6).
      const pkg = "@capacitor/" + "haptics";
      const mod = (await import(/* @vite-ignore */ pkg)) as { Haptics: CapHaptics };
      this.cap = mod.Haptics;
    } catch {
      this.cap = null;
    }
  }

  fire(pattern: Pattern): void {
    if (!this.enabled) return;
    if (this.cap) {
      this.fireNative(pattern);
      return;
    }
    if (this.canVibrate) navigator.vibrate(WEB_PATTERNS[pattern]);
  }

  private fireNative(pattern: Pattern): void {
    if (!this.cap) return;
    try {
      switch (pattern) {
        case "tick":
        case "light":
          void this.cap.impact({ style: "LIGHT" });
          break;
        case "medium":
          void this.cap.impact({ style: "MEDIUM" });
          break;
        case "heavy":
          void this.cap.impact({ style: "HEAVY" });
          break;
        case "success":
          void this.cap.notification({ type: "SUCCESS" });
          break;
        case "warning":
          void this.cap.notification({ type: "WARNING" });
          break;
      }
    } catch {
      /* ignore */
    }
  }
}

const WEB_PATTERNS: Record<Pattern, number | number[]> = {
  tick: 8,
  light: 12,
  medium: 22,
  heavy: 40,
  success: [14, 30, 14],
  warning: [30, 40, 30],
};
