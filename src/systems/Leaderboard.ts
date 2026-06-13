/**
 * Leaderboard abstraction (BRIEF §1.6). The game only ever talks to the
 * `LeaderboardService` interface, so the backend (local, Supabase, or one day
 * Game Center via Capacitor) can be swapped without touching scenes.
 *
 * - Local scores are always kept in localStorage.
 * - Online (global) scores use Supabase IF the env vars are configured;
 *   otherwise the online provider quietly reports "unavailable" and the UI
 *   shows the local board only. This keeps the game fully playable offline.
 *
 * Supabase setup (free tier): create a table
 *   create table scores (
 *     id bigint generated always as identity primary key,
 *     name text not null,
 *     score int not null,
 *     distance int not null default 0,
 *     created_at timestamptz default now()
 *   );
 * Enable RLS with an insert + select policy for the anon role.
 * Then set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file.
 */

export interface ScoreEntry {
  name: string;
  score: number;
  distance: number;
  /** Marks the local player's own entry so the UI can highlight it. */
  isYou?: boolean;
}

export interface LeaderboardResult {
  entries: ScoreEntry[];
  playerRank: number | null;
  available: boolean;
  source: "local" | "global";
}

export interface LeaderboardService {
  readonly onlineEnabled: boolean;
  submit(entry: ScoreEntry): Promise<void>;
  top(limit: number): Promise<LeaderboardResult>;
  topGlobal(limit: number): Promise<LeaderboardResult>;
}

const LOCAL_KEY = "nevermore.leaderboard.v1";

function readLocal(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: ScoreEntry[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

// Minimal structural type for the Supabase client bits we use.
interface SupabaseLike {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: unknown }>;
    select: (cols: string, opts?: unknown) => any;
  };
}

export class Leaderboard implements LeaderboardService {
  private supabase: SupabaseLike | null = null;
  private supabaseReady: Promise<void> | null = null;
  readonly onlineEnabled: boolean;

  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    this.onlineEnabled = Boolean(url && key);
    if (this.onlineEnabled) this.supabaseReady = this.initSupabase(url!, key!);
  }

  private async initSupabase(url: string, key: string): Promise<void> {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      this.supabase = createClient(url, key) as unknown as SupabaseLike;
    } catch {
      this.supabase = null;
    }
  }

  async submit(entry: ScoreEntry): Promise<void> {
    // Local (always)
    const list = readLocal();
    list.push({ name: entry.name, score: entry.score, distance: entry.distance });
    list.sort((a, b) => b.score - a.score);
    writeLocal(list);

    // Global (best-effort)
    if (!this.onlineEnabled) return;
    try {
      await this.supabaseReady;
      if (!this.supabase) return;
      await this.supabase.from("scores").insert({
        name: entry.name.slice(0, 16),
        score: Math.round(entry.score),
        distance: Math.round(entry.distance),
      });
    } catch {
      /* offline / blocked — local already saved */
    }
  }

  async top(limit: number): Promise<LeaderboardResult> {
    const list = readLocal().sort((a, b) => b.score - a.score);
    const best = list[0]?.score ?? null;
    const entries = list.slice(0, limit).map((e, i) => ({ ...e, isYou: i === 0 && best !== null }));
    return { entries, playerRank: list.length ? 1 : null, available: true, source: "local" };
  }

  async topGlobal(limit: number): Promise<LeaderboardResult> {
    if (!this.onlineEnabled) {
      return { entries: [], playerRank: null, available: false, source: "global" };
    }
    try {
      await this.supabaseReady;
      if (!this.supabase) throw new Error("no client");
      const { data, error } = await this.supabase
        .from("scores")
        .select("name,score,distance", { count: "exact" })
        .order("score", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const entries = (data ?? []) as ScoreEntry[];
      return { entries, playerRank: null, available: true, source: "global" };
    } catch {
      return { entries: [], playerRank: null, available: false, source: "global" };
    }
  }
}
