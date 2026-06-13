import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor config (BRIEF §6 — phase 6). This file is ready for when you want a
 * native iOS build for TestFlight / the App Store. It is NOT needed for PWA
 * testing on your iPhone (see README). Run `npx cap add ios` once, then
 * `npm run build && npx cap sync` to update the native shell.
 */
const config: CapacitorConfig = {
  appId: "com.nevermore.game",
  appName: "NEVERMORE",
  webDir: "dist",
  backgroundColor: "#06060d",
  ios: {
    contentInset: "always",
    backgroundColor: "#06060d",
  },
};

export default config;
